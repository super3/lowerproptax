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

- [ ] **README.md** - Roadmap still mentions "appeal guidance"

- [ ] **src/README.md** - API documentation uses "assessment" generically without homestead context
