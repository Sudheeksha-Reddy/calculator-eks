# Project B: CI/CD to AWS EKS (Notes)

> Started October 2026. Simple Tenglish. Secrets (tokens, keys, account ID) ikkada EPPUDU raayakudadu, repo public.

## Goal (okka line lo)
Code merge ayithe: **test -> Docker image build -> scan -> ECR ki push -> EKS lo dev ki deploy**.
Version tag + approval tho **same image** prod ki deploy.

```
PR            -> test + docker build + scan                  (CI)
merge to main -> build -> scan -> push ECR -> deploy EKS "dev" (CD, automatic)
tag v1.0.0    -> [MY APPROVAL] -> deploy SAME image to "prod"
```

**Okka line lo motham idea:** developer code raasina ventane, automatic ga test ayyi, box (image) lo packed ayyi,
scan ayyi, safe ga store ayyi, approval tho servers meeda run avvali. Manishi marchipoyina, mistake chesina,
broken leda insecure code users daaka vellakudadu.

## Motham journey: prathi step ki PROBLEM -> SOLUTION (10 years tarvata ide mundu chadavu)
| # | Problem (idi lekapothe emi jarugutundi) | Solution | Project |
|---|---|---|---|
| 1 | Code correct aa ani manishi manual ga check cheyyali, miss avutundi | Tests (`npm test`) | A |
| 2 | Code laptop lo matrame, laptop pothe code pothundi | GitHub repo | A |
| 3 | Developers tests run cheyyadam marchipotaru, "naa laptop lo work avtundi" | CI (GitHub Actions, fresh machine) | A |
| 4 | CI red unna evaraina merge click cheyyochu | Ruleset (PR + required `test` check) | A |
| 5 | Functions matrame, users / browser call cheyyaleru | Express API (`/add`, `/health`, `/version`) | B |
| 6 | "Naa machine lo work avtundi, server lo avvadu" | Docker image (app + Node + deps okka box) | B |
| 7 | Image build ayyindi kani app start avutundo teliyadu | Smoke test (container run + `curl /health`) | B |
| 8 | Image lo security holes | Trivy scan + multi-stage (npm remove) | B |
| 9 | AWS resources marchipothe surprise bill | Budget alert ($5) | B |
| 10 | Image runner tho paatu delete avutundi | ECR (image store) | B |
| 11 | AWS access keys GitHub lo pedithe leak risk | OIDC + IAM role (temporary credentials) | B |
| 12 | App run avvadaniki servers kavali, crash ayithe restart | EKS (Kubernetes) | B |
| 13 | Prathi merge ki manual deploy, slow + mistakes | CD: auto deploy to `dev` | B |
| 14 | Untested code prod ki velithe users ki problem | Same image + manual approval for `prod` | B |
| 15 | Kotha version lo bug | Rollback (old image tag) | B |

## Order enduku ila? ("free and local first, paid and cloud last")
| Order | Phase | AWS kavala? | Cost |
|---|---|---|---|
| 1 | App + tests, local | Ledu | Free |
| 2 | Dockerfile, image build | Ledu | Free |
| 3 | GitHub repo + CI (test, build, scan) | Ledu | Free |
| 4 | Budget alert ($5) | Avunu | Free |
| 5 | ECR + OIDC role, CI push to ECR | Avunu | Almost free |
| 6 | EKS cluster + deploy dev / prod | Avunu | **Per hour bill** |
| 7 | Rollback test, then delete everything | Avunu | |

- Okka time lo okka layer: error vachinappudu ye layer lo problem ani easy ga telustundi.
- EKS gantaku bill, kabatti chivara create chesi, test chesi, delete.
- Real companies lo kuda: CI first (build, test, scan), CD tarvata (deploy).

---

## Phase 1: Calculator API (local)

### Files
| File | Emi chestundi |
|---|---|
| `package.json` | `npm start` = server start, `npm test` = tests. Dependency: Express 5 |
| `package-lock.json` | Exact dependency versions lock. CI lo `npm ci` deeni nunchi same versions install. **Git lo commit cheyyali** |
| `src/calculator.js` | Logic: `add`, `divide` (Project A nunchi same) |
| `src/app.js` | API routes: `/health`, `/version`, `/add`, `/divide` |
| `src/server.js` | App ni port meeda start (`PORT` env, default 3000) |
| `test/calculator.test.js` | Logic tests |
| `test/app.test.js` | API tests (real HTTP calls) |

### Concepts
- **Express** = Node lo web server / API build cheyyadaniki library.
- **`/health`** = Kubernetes ee URL ni konni seconds ki call chestundi. Response raakapothe pod restart chestundi.
- **`/version`** = ye version run avutundo chupistundi (`APP_VERSION` env, pipeline set chestundi). Deploy / rollback ayyindo ledo proof.
- **400 error** = wrong input (text, divide by zero) ki crash kaakunda clear error message.
- **`app.js` and `server.js` separate enduku?** Tests lo app ni random port lo start cheyyadaniki. Define cheyyadam okka file, start cheyyadam inkoka file.
- **`app.listen(0)`** = port 0 ante "free ga unna ye port aina". Port 3000 busy unna tests fail avvavu. CI lo important.

### Commands
```bash
npm install express@5   # dependency install, package-lock.json create
npm test                # expected: # pass 6, # fail 0
npm start               # http://localhost:3000/add?a=2&b=3 -> {"result":5}
```
Server aapalante Ctrl + C.

### Errors + fixes
- (Inka emi raaledu. Vachinappudu ikkada raayi: situation, kaaranam, fix, lesson.)

### Interview questions
- **Q: `package-lock.json` enduku commit cheyyali?** (nee answer raayi)
- **Q: `/health` endpoint enduku?** (nee answer raayi)

---

## Phase 2 + 3: Dockerfile + CI (build, smoke test, scan)

### Mac lo Docker lekunda image ela build chesam?
- GitHub Actions runner (`ubuntu-latest`) lo **Docker already install ayyi untundi**.
- Mac lo Dockerfile (text recipe) raasi push chesthe, runner `docker build` chestundi.
- Runner pani ayyaka delete avutundi, image kuda pothundi. Anduke tarvata **ECR** ki push chestam (save).
- Analogy: Dockerfile = cake recipe. Runner = bakery kitchen (oven = Docker). ECR = fridge.

### Dockerfile key points
| Line / idea | Enduku |
|---|---|
| `node:24-alpine` | Chinna image. Node 20 April 2026 lo end-of-life |
| `COPY package*.json` mundu, `COPY src` tarvata | **Layer caching**: code maarithe dependencies layer reuse, build fast |
| `npm ci --omit=dev` | Lock file exact versions, dev deps lekunda |
| **Multi-stage** (`AS deps`, then final stage) | npm build stage lo matrame. Final image lo npm ledu |
| `rm -rf .../npm ...` | Runtime ki npm avasaram ledu. Remove chesthe vulnerabilities pothayi, image chinnadi |
| `USER node` | **Non-root**. Container hack ayina root power undadu |
| `.dockerignore` | `node_modules`, `.git`, tests image loki vellavu. Chinna, safe |

### CI workflow (`.github/workflows/ci.yml`)
```
test (npm ci + npm test) ──needs──► docker (build -> run -> curl /health -> Trivy)
```
- `needs: test`: tests fail ayithe image build cheyyadu.
- Image tag = `${{ github.sha }}` (git commit SHA). `latest` vaadamu: ye version o teliyadu.
- **Smoke test**: container nijanga start ayyi `/health`, `/add` answer chestundo real call.
- `if: failure()`: fail ayithe container logs chupistundi.
- **Trivy**: HIGH / CRITICAL unte `--exit-code 1`, pipeline fail. `--ignore-unfixed` = fix inka release avvani vaati valla fail cheyyadu. Scanner version pinned (`aquasec/trivy:0.58.0`).

### Error: Trivy failed, 3 HIGH vulnerabilities
- **Situation:** first CI run lo test ✅, build ✅, smoke test ✅, **Trivy ❌**.
- **Trivy cheppindi:** `brace-expansion` (2 CVEs), `undici` (1 CVE), anni HIGH, "fixed" versions available.
- **Investigation:** mana `package-lock.json` lo ee packages **levu** (`grep` = 0). Ante mana app kaadu.
  Avi base image lo unna **npm tool** lopala bundled packages (`/usr/local/lib/node_modules/npm`).
- **Fix:** multi-stage Dockerfile. npm tho dependencies stage 1 lo install, final image lo npm / npx / corepack / yarn **delete**. App ki runtime lo `node` matrame kavali.
- **Result:** Trivy `Total: 0`, pipeline green.
- **Lesson:**
  1. Vulnerability vachinappudu mundu **"ee package ekkadi nunchi vachindi?"** chudali: mana dependency aa, base image aa, OS package aa.
  2. Final image lo **runtime ki kavalsinavi matrame** undali (minimal image = thakkuva attack surface).
  3. Fix options order: upgrade / remove > base image update > `.trivyignore` (reason tho, last option).

### Interview questions
- **Q: Multi-stage Docker build enduku?** Build tools (npm, compilers) final image lo undakudadu. Image chinnadi, vulnerabilities thakkuva.
- **Q: Trivy HIGH vulnerability report chesindi, mana code lo aa package ledu. Emi chestav?** (nee answer raayi)
- **Q: Image tag ki `latest` enduku vaadakudadu?** (nee answer raayi)

---

## Phase 4: Budget alert
- **Problem:** AWS lo resources (EKS laantivi) delete marchipothe nelaki ~$150 bill.
- **Emi:** AWS Budgets lo `practice-5usd`: monthly $5. Actual > 80% ($4) aithe email, Forecast > 100% (month end ki $5 daatutundi ani AWS guess) aithe email.
- **Gurtu:** budget **email matrame** pampistundi, resources ni aapadu. Delete cheyyadam mana pani.

---

## Phase 5: ECR (Elastic Container Registry)

### ECR ante enti?
**ECR = AWS lo Docker images store chese private godown.**

| Concept | Ardham |
|---|---|
| Registry | Images store chese service (ECR, Docker Hub, GHCR) |
| Repository | Registry lopala **okka app** images ki folder. Manadi `calculator-eks` |
| Image tag | Prathi image version ki peru. Manam **git commit SHA** vaadutunnam |

```
ECR (registry, naa AWS account, Mumbai region)
└── calculator-eks          <- repository (mana app)
    ├── 2478224...          <- image (commit 1)
    ├── 418e5b2...          <- image (commit 2)
    └── ...
```

### ECR lekapothe problem enti?
GitHub runner lo image build avutundi. Runner pani ayyaka **delete**, image kuda pothundi.
```
Runner: build OK -> test OK -> scan OK -> runner DELETE -> image GONE
```
EKS deploy cheyyali ante image ekkadaina **permanent ga** undali. Anduke ECR.

### ECR vs Docker Hub (enduku ECR?)
| | Docker Hub (free) | ECR |
|---|---|---|
| Private | Limited | Private by default |
| EKS tho connection | Username / password secret kavali | **IAM** tho direct, passwords levu |
| Pull speed | Internet nunchi | Same AWS region, fast |
| Pull limits | Rate limits untayi | Levu |

### Command 1: Repository create
```bash
aws ecr create-repository \
  --repository-name calculator-eks \
  --image-tag-mutability IMMUTABLE \
  --image-scanning-configuration scanOnPush=true \
  --query 'repository.repositoryUri' --output text
```
| Part | Emi | Problem solve |
|---|---|---|
| `create-repository` | ECR lo kotha folder | Image save cheyyadaniki place |
| `--repository-name calculator-eks` | Folder peru | App peru tho match |
| `--image-tag-mutability IMMUTABLE` | Tag okasari push ayithe overwrite cheyyalevu | Kinda chudu |
| `scanOnPush=true` | Push ayyinappudu AWS automatic scan | Kinda chudu |
| `--query ... --output text` | Output lo repo address (URI) matrame | Long JSON avasaram ledu |

Output = image **full address** (URI):
```
<account-id>.dkr.ecr.ap-south-1.amazonaws.com/calculator-eks
 mee account   ECR   Mumbai region             repo
```
CI push chesetappudu, EKS pull chesetappudu ide address.

### IMMUTABLE tags (chala important)
**MUTABLE lo problem:**
1. Monday: `v1` tag tho image A push, prod lo deploy.
2. Tuesday: evaro `v1` tag tho **different** image B push (mistake / attack).
3. Prod pod restart ayithe `v1` pull chesthe **image B** vastundi. Evaru deploy cheyyakunda prod maaripoyindi.

**IMMUTABLE tho:** step 2 lo ECR reject: "tag already exists".
- **Relief:** same tag = eppudu same image. Prod lo emi run avutundo exact ga telustundi, rollback reliable.
- Mana tags = git SHA (prathi commit ki unique), kabatti conflict ledu.
- Analogy: bank cheque number. Okasari issue ayina number ki malli inko cheque ivvaru.

### scanOnPush
- Image ECR ki vachinappudu AWS **basic scan** (OS packages). Free.
- Trivy unna enduku? **Defense in depth** (rendu layers):
  - Trivy (CI lo) = push **mundu** block.
  - ECR scan = push **tarvata** registry lo record, Console lo chudochu.
- Analogy: airport security check (Trivy) + boarding gate daggara malli check (ECR).

### Command 2: Lifecycle policy (old images auto delete)
```bash
aws ecr put-lifecycle-policy --repository-name calculator-eks --lifecycle-policy-text '{
  "rules":[{"rulePriority":1,"description":"Keep last 10 images",
    "selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":10},
    "action":{"type":"expire"}}]}'
```
| Part | Ardham |
|---|---|
| `rulePriority: 1` | Rules order (okkate rule) |
| `tagStatus: any` | Tagged / untagged anni images |
| `imageCountMoreThan: 10` | 10 kanna ekkuva unte |
| `action: expire` | Old images delete, latest 10 untayi |

- **Problem:** prathi commit ki kotha image. Months lo vandala images, storage bill.
- **Relief:** automatic cleanup. Last 10 rollback ki saripotayi.
- Real company: prod images delete avvakudadu, kabatti `v*` tags ki separate rule (ex: last 50) pedataru.

### ECR state (verify chesina)
| Setting | Value |
|---|---|
| Repository | `calculator-eks` |
| Region | `ap-south-1` (Mumbai) |
| Tag mutability | IMMUTABLE |
| Scan on push | True |
| Lifecycle | Keep last 10 |

Verify commands:
```bash
aws ecr describe-repositories --query 'repositories[].{name:repositoryName,mutability:imageTagMutability,scan:imageScanningConfiguration.scanOnPush}' --output table
aws ecr get-lifecycle-policy --repository-name calculator-eks --query lifecyclePolicyText --output text
aws ecr describe-images --repository-name calculator-eks --output table
```

### ECR ni evaru vaadutaru
```
GitHub Actions --PUSH--> ECR calculator-eks --PULL--> EKS nodes
 (OIDC role: ECR push permission)       (node role: ECR read permission)
```
Push and pull ki **separate permissions**. Rendu different identities.

### Interview questions (ECR)
1. **Why IMMUTABLE tags?** Same tag = same image eppudu. Prod silent ga maaradu, rollback reliable.
2. **Why lifecycle policy?** Storage cost control, old images auto delete.
3. **ECR vs Docker Hub?** Private, IAM auth (no passwords), same region fast pulls, no rate limits.
4. **Trivy unna scanOnPush enduku?** Defense in depth: CI lo block, registry lo record.
5. **EKS ECR nunchi pull ela chestundi, password lekunda?** Node IAM role ki ECR read permission.
