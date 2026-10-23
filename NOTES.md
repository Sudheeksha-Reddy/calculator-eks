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
