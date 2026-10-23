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
