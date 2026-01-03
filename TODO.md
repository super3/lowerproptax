# Homestead Exemption Pivot - TODO

Changes needed to pivot from property tax appeals to homestead exemption savings discovery.

## High Priority (Legal/User-Facing)

- [ ] **terms.html** - Major rewrite needed
  - [ ] Section 5.1 "Nature of Service" - references appeals and comparables data
  - [ ] Section 6 "User Responsibilities for Appeals" - entire section focused on appeals
  - [ ] Liability disclaimers reference "appeal success" and "missed appeal deadlines"

- [ ] **emailService.js** - Update notification content
  - [ ] Email says "Your property tax assessment is ready" - needs homestead context
  - [ ] Should explain this is a homestead exemption eligibility analysis
  - [ ] Add next steps like "File with your county assessor"

- [ ] **property.html** - Status messages lack context
  - [ ] "We're gathering data" and "assessment is complete" need to explain homestead exemption purpose

## Medium Priority (Clarity)

- [ ] **dashboard.html** - Multiple "assessment" references without homestead context

- [ ] **index.html** - Feature bullets reference "assessments" without explaining what that means

- [ ] **admin.html / admin-property.html** - Admin interface could use labels explaining homestead context

- [ ] **README.md** - Roadmap still mentions "appeal guidance"

- [ ] **src/README.md** - API documentation uses "assessment" generically without homestead context

## Low Priority (Nice-to-have)

- [ ] **scripts/scrapePropertyDetails.js** - Comments still reference "comps"

- [ ] **Test descriptions** - Could add homestead exemption context for clarity

- [ ] **Database table name** - `assessments` could be renamed to `homestead_assessments` for clarity (breaking change, complex)

---

## What's Already Good

- **Backend logic** - Already works perfectly for homestead exemption analysis
- **Data model** - `annual_tax` vs `estimated_annual_tax` is exactly what's needed
- **Savings calculation** - Email already shows potential savings correctly
- **Status values** - 'preparing', 'ready', 'invalid' work well for exemption checks
- **Sales table** - Already dropped (was for comps)
- **Homepage hero/copy** - Already pivoted in recent commits

The pivot is mostly **messaging and terminology** - the core functionality already supports homestead exemption analysis well.
