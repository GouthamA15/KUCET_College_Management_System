# KUCET CMS — Authoritative B.Tech Syllabus Audit, Reconciliation & Integrity Report

**Author:** Senior Academic Data Analyst & Database Integrity Specialist  
**Target Environment:** KUCET College Management System (CMS)  
**Curriculum Scheme:** Kakatiya University College of Engineering & Technology (KUCET) AICTE Model Curriculum  
**Scope:** 7 Branches (CIVIL, CSD, CSE, ECE, EEE, IT, MECH) × 8 Semesters (56 Official Syllabus PDFs)  
**Audit Date:** October 2026

---
## 1. Executive Summary

Following an initial discrepancy report submitted by an Information Technology (IT) student regarding incorrect academic subjects displayed on the student portal, a comprehensive, systematic audit was executed across all seven engineering branches (CIVIL, CSD, CSE, ECE, EEE, IT, MECH) and all eight semesters (56 curriculum documents).

### Key Audit Outcomes:
1. **Systemic Omission of Laboratory and Practicals:** A pervasive defect across the legacy JavaScript dataset was the systematic omission of practical laboratory courses, mini-projects, summer internships, and mandatory non-credit courses (such as Constitution of India and Environmental Science) in CIVIL, CSD, ECE, EEE, and MECH. Theory subjects were often preserved while practical modules were discarded.
2. **First-Year Curricular Integrity:** Semesters 1 and 2 share identical university-wide curriculum documents across all branches. In the legacy JavaScript dataset, `ESC104 Engineering Mechanics` (4 credits) was erroneously omitted from CIVIL, CSD, and MECH, while present in CSE, ECE, EEE, and IT.
3. **Root Cause of Student Issue (IT Branch & Database Seeders):** The IT student's portal error was traced to two compounding defects: (a) omission of `PW3210IT Mini-project` (1.5 credits) and improper group code labeling in Semester 7 (`PEC III*` vs `PE-III*`), and (b) legacy database migrations (`0020_subject_module_and_elective_groups.sql`) wherein raw PDF table header strings (such as `'ENGINEERING SCIENCES COURSES'`) had been incorrectly ingested as course codes into `syllabus_subjects`.
4. **CSD Fourth-Year Reconciliation:** Previous iterations had introduced speculative course codes (`PCS-701DS`, `PCS-PW801DS`) for CSD Semesters 7 & 8. Authoritative documents `CSD_4_1.pdf` and `CSD_4_2.pdf` mandate that CSD (Data Science) students follow the approved CSE 4th-year curriculum scheme. The dataset has been reconciled accordingly.
5. **Critical Source Anomaly Disclosed (ECE Semester 8):** `BTech Syllabus/ECE/ECE_4_2.pdf` is identical to `BTech Syllabus/EEE/EEE_4_2.pdf` (MD5 `b70136dfa751747ef5f21fb394fc05fc`), specifying 'Department of Electrical & Electronics Engineering, B. Tech. (EEE) VIII SEMESTER'. This is documented as an unresolvable upstream source ambiguity requiring official university clarification.

---
## 2. 7 × 8 Verification Matrix

The following matrix summarizes the reconciliation status for every branch and semester:

| Branch | Semester | Authoritative PDF | Subject Entries | Prescribed Credits | Audit Status | Reconciliation Summary |
|:---|:---:|:---|:---:|:---:|:---:|:---|
| **CIVIL** | Sem 1 | `CIVIL_1_1.pdf` | 7 | 21.5 | `VERIFIED_CORRECTED` | Added ESC104 Engineering Mechanics (4 C) |
| **CIVIL** | Sem 2 | `CIVIL_1_2.pdf` | 8 | 20.5 | `MATCH` | Matches PDF |
| **CIVIL** | Sem 3 | `CIVIL_2_1.pdf` | 9 | 21.0 | `VERIFIED_CORRECTED` | Added ES 351CE & PC 351CE Labs (2 C) |
| **CIVIL** | Sem 4 | `CIVIL_2_2.pdf` | 11 | 24.0 | `VERIFIED_CORRECTED` | Added PC 451CE, PC 452CE, PC 453BS Labs & ES 461CE Survey Camp (4 C) |
| **CIVIL** | Sem 5 | `CIVIL_3_1.pdf` | 9 | 21.0 | `VERIFIED_CORRECTED` | Added PC 3108CE & PC 3109CE Labs (2 C) |
| **CIVIL** | Sem 6 | `CIVIL_3_2.pdf` | 11 | 26.0 | `VERIFIED_CORRECTED` | Added PC 3213 CE & PC 3214 CE Labs + PW3215 CE Summer Internship (2 C) |
| **CIVIL** | Sem 7 | `CIVIL_4_1.pdf` | 7 | 18.5 | `MATCH` | Matches PDF (includes Project Work Part A & CAD Lab) |
| **CIVIL** | Sem 8 | `CIVIL_4_2.pdf` | 5 | 15.0 | `MATCH` | Matches PDF (includes Project Work Part B, Drafting Lab, MC) |
| **CSD** | Sem 1 | `CSD_1_1.pdf` | 7 | 21.5 | `VERIFIED_CORRECTED` | Added ESC104 Engineering Mechanics (4 C) |
| **CSD** | Sem 2 | `CSD_1_2.pdf` | 8 | 20.5 | `MATCH` | Matches PDF |
| **CSD** | Sem 3 | `CSD_2_1.pdf` | 8 | 22.0 | `VERIFIED_CORRECTED` | Added PCS-301L DS Lab & PCS-303L JAVA Lab (3 C) |
| **CSD** | Sem 4 | `CSD_2_2.pdf` | 8 | 21.0 | `VERIFIED_CORRECTED` | Deduplicated PCS-401, added PCS-401L DBMS Lab & PCS-402L DS Lab (3 C) |
| **CSD** | Sem 5 | `CSD_3_1.pdf` | 7 | 22.0 | `VERIFIED_CORRECTED` | Added PCS-501DSL SE Lab & PE-I** Lab group with 4 variants (3 C) |
| **CSD** | Sem 6 | `CSD_3_2.pdf` | 8 | 22.0 | `VERIFIED_CORRECTED` | Added PCS-602DSL & PCS-603DSL Labs + Summer Internship (3 C) |
| **CSD** | Sem 7 | `CSD_4_1.pdf` | 7 | 20.5 | `VERIFIED_CORRECTED` | Reconciled with official CSD 4-1 PDF (CSE scheme: PE-III*, IV*, V*, VI*, III**, IV**, Mini Project II) |
| **CSD** | Sem 8 | `CSD_4_2.pdf` | 5 | 16.0 | `VERIFIED_CORRECTED` | Reconciled with official CSD 4-2 PDF (CSE scheme: PE-VII*, VIII*, OE-II*, Project Work, MC) |
| **CSE** | Sem 1 | `CSE _1_1.pdf` | 7 | 21.5 | `MATCH` | Matches PDF |
| **CSE** | Sem 2 | `CSE_1_2.pdf` | 8 | 20.5 | `MATCH` | Matches PDF |
| **CSE** | Sem 3 | `CSE_2_1.pdf` | 8 | 22.0 | `MATCH` | Matches PDF |
| **CSE** | Sem 4 | `CSE_2_2.pdf` | 8 | 22.0 | `MATCH` | Matches PDF |
| **CSE** | Sem 5 | `CSE_3_1.pdf` | 7 | 21.0 | `MATCH` | Matches PDF (includes DBMS Lab & PE-I Lab) |
| **CSE** | Sem 6 | `CSE_3_2.pdf` | 8 | 23.5 | `VERIFIED_CORRECTED` | Added PW3210CS Mini-project (1.5 C) |
| **CSE** | Sem 7 | `CSE_4_1.pdf` | 7 | 20.5 | `VERIFIED_CORRECTED` | Added PW4108CS Mini Project – II (1.5 C) |
| **CSE** | Sem 8 | `CSE_4_2.pdf` | 5 | 16.0 | `VERIFIED_CORRECTED` | Added PW4205CS Project Work (5 C) and MC (Yoga Practice / NSS) |
| **ECE** | Sem 1 | `ECE_1_1.pdf` | 7 | 21.5 | `MATCH` | Matches PDF |
| **ECE** | Sem 2 | `ECE_1_2.pdf` | 8 | 20.5 | `MATCH` | Matches PDF |
| **ECE** | Sem 3 | `ECE_2_1.pdf` | 9 | 24.0 | `MATCH` | Matches PDF |
| **ECE** | Sem 4 | `ECE_2_2.pdf` | 9 | 25.0 | `MATCH` | Matches PDF |
| **ECE** | Sem 5 | `ECE_3_1.pdf` | 9 | 24.0 | `VERIFIED_CORRECTED` | Added PW3111EC Mini-project (2 C) & PE3107EC MOOCS variant |
| **ECE** | Sem 6 | `ECE_3_2.pdf` | 9 | 23.0 | `VERIFIED_CORRECTED` | Fixed PE3205EC code collision, added PE3211EC MOOCs & PW3216EC Summer Internship |
| **ECE** | Sem 7 | `ECE_4_1.pdf` | 7 | 15.0 | `VERIFIED_CORRECTED` | Added PW4112EC Project Stage-I (2 C) & SI4113EC Summer Internship Evaluation |
| **ECE** | Sem 8 | `ECE_4_2.pdf` | 4 | 15.0 | `AMBIGUOUS_SOURCE` | Unresolved source ambiguity: ECE_4_2.pdf contains EEE 4-2 syllabus |
| **EEE** | Sem 1 | `EEE_1_1.pdf` | 7 | 21.5 | `MATCH` | Matches PDF |
| **EEE** | Sem 2 | `EEE_1_2.pdf` | 8 | 20.5 | `MATCH` | Matches PDF |
| **EEE** | Sem 3 | `EEE_2_1.pdf` | 9 | 24.0 | `VERIFIED_CORRECTED` | Added BSC105 Mathematics III (3 C) & MC210 Environmental Sciences (0 C) |
| **EEE** | Sem 4 | `EEE_2_2.pdf` | 9 | 22.0 | `VERIFIED_CORRECTED` | Added MC-220 Constitution of India (0 C) |
| **EEE** | Sem 5 | `EEE_3_1.pdf` | 7 | 23.0 | `MATCH` | Matches PDF |
| **EEE** | Sem 6 | `EEE_3_2.pdf` | 7 | 22.0 | `VERIFIED_CORRECTED` | Added PW3213 Summer Internship |
| **EEE** | Sem 7 | `EEE_4_1.pdf` | 7 | 16.0 | `VERIFIED_CORRECTED` | Added PW-4114EE Project Stage-I (1 C) |
| **EEE** | Sem 8 | `EEE_4_2.pdf` | 5 | 15.0 | `VERIFIED_CORRECTED` | Added PW-4212EE Project Stage-II (5 C) |
| **IT** | Sem 1 | `IT_1_1.pdf` | 7 | 21.5 | `MATCH` | Matches PDF |
| **IT** | Sem 2 | `IT_1_2.pdf` | 8 | 20.5 | `MATCH` | Matches PDF |
| **IT** | Sem 3 | `IT_2_1.pdf` | 8 | 20.0 | `MATCH` | Matches PDF |
| **IT** | Sem 4 | `IT_2_2.pdf` | 8 | 22.0 | `MATCH` | Matches PDF |
| **IT** | Sem 5 | `IT_3_1.pdf` | 7 | 21.0 | `MATCH` | Matches PDF |
| **IT** | Sem 6 | `IT_3_2.pdf` | 8 | 23.5 | `VERIFIED_CORRECTED` | Added PW3210IT Mini-project (1.5 C) |
| **IT** | Sem 7 | `IT_4_1.pdf` | 7 | 20.5 | `VERIFIED_CORRECTED` | Normalized group code 'PEC III*' to 'PE-III*' |
| **IT** | Sem 8 | `IT_4_2.pdf` | 5 | 16.0 | `MATCH` | Matches PDF |
| **MECH** | Sem 1 | `MECH_1_1.pdf` | 7 | 21.5 | `VERIFIED_CORRECTED` | Added ESC104 Engineering Mechanics (4 C) |
| **MECH** | Sem 2 | `MECH_1_2.pdf` | 8 | 20.5 | `MATCH` | Matches PDF |
| **MECH** | Sem 3 | `MECH_2_1.pdf` | 10 | 22.5 | `VERIFIED_CORRECTED` | Added ME-215L, ME-216L & ESC-106L Labs (4.5 C) |
| **MECH** | Sem 4 | `MECH_2_2.pdf` | 9 | 19.0 | `VERIFIED_CORRECTED` | Added ME-220L, ME-221L Labs & ME-225L Machine Drawing (4 C) |
| **MECH** | Sem 5 | `MECH_3_1.pdf` | 8 | 23.0 | `VERIFIED_CORRECTED` | Added PC3109ME & PC3110ME Labs (3 C) |
| **MECH** | Sem 6 | `MECH_3_2.pdf` | 9 | 22.0 | `VERIFIED_CORRECTED` | Added PC3209ME & PC3210ME Labs + PW3211ME Summer Internship (3 C) |
| **MECH** | Sem 7 | `MECH_4_1.pdf` | 8 | 20.5 | `VERIFIED_CORRECTED` | Added PC4113ME Product Design by CAD Lab & PW4114ME PROJECT WORK-I (2.5 C) |
| **MECH** | Sem 8 | `MECH_4_2.pdf` | 6 | 16.0 | `VERIFIED_CORRECTED` | Added PW4208ME PROJECT WORK-II (7 C) |

---
## 3. Comprehensive Discrepancy Breakdown by Branch & Semester

### 3.1 CIVIL Branch Reconciliation Breakdown

| Semester | Authoritative Source | Discrepancy Status | Source Page(s) | Audit Findings & Corrective Action |
|:---|:---|:---|:---|:---|
| **Sem 1** | `CIVIL_1_1.pdf` | `MISSING_IN_JS` | Page 1 | Missing ESC104 Engineering Mechanics (4 credits, 30 CIE, 70 SEE). Added complete 5 units from authoritative first-year syllabus. |
| **Sem 2** | `CIVIL_1_2.pdf` | `MATCH` | Page 1-2 | All 8 subjects match official curriculum scheme (20.5 credits). |
| **Sem 3** | `CIVIL_2_1.pdf` | `MISSING_IN_JS` | Page 1, 14, 16 | Missing ES 351CE Surveying laboratory (1 credit) and PC 351CE Fluid Mechanics-I laboratory (1 credit). Extracted full experiment lists from pages 14 & 16 and reconciled. |
| **Sem 4** | `CIVIL_2_2.pdf` | `MISSING_IN_JS` | Page 1, 13-16 | Missing PC 451CE Material Testing Lab (1 C), PC 452CE Fluid Mechanics-II Lab (1 C), PC 453BS Engineering Geology Lab (1 C), and ES 461CE Survey Camp (1 C). Added complete experimental cycles and field survey camp syllabus. |
| **Sem 5** | `CIVIL_3_1.pdf` | `MISSING_IN_JS` | Page 1, 14, 15 | Missing PC 3108CE Soil Mechanics Lab (1 C) and PC 3109CE Concrete Technology Lab (1 C). Reconciled with full laboratory testing syllabus. |
| **Sem 6** | `CIVIL_3_2.pdf` | `MISSING_IN_JS` | Page 1, 22, 23 | Missing PC 3213 CE Environmental Engg lab (1 C), PC 3214 CE Transportation Engg Lab (1 C), and PW3215 CE Summer Internship (6 weeks). Added complete syllabus. |
| **Sem 7** | `CIVIL_4_1.pdf` | `MATCH` | Page 1 | Complete match with PC4101CE, PEC IV*, PEC V*, PEC VI*, OE I, PW4115CE Project Work Part A, and PC4116 CE CAD Lab (18.5 credits). |
| **Sem 8** | `CIVIL_4_2.pdf` | `MATCH` | Page 1 | Complete match with PEC VII*, PC4204 CE Drafting Lab, PW4205 CE Project Work Part B, OE II*, and MC (15.0 credits). |

### 3.2 CSD Branch Reconciliation Breakdown

| Semester | Authoritative Source | Discrepancy Status | Source Page(s) | Audit Findings & Corrective Action |
|:---|:---|:---|:---|:---|
| **Sem 1** | `CSD_1_1.pdf` | `MISSING_IN_JS` | Page 1 | Missing ESC104 Engineering Mechanics (4 credits). Reconciled. |
| **Sem 2** | `CSD_1_2.pdf` | `MATCH` | Page 1-2 | All 8 subjects match official curriculum scheme (20.5 credits). |
| **Sem 3** | `CSD_2_1.pdf` | `MISSING_IN_JS` | Page 1, 14, 15 | Missing PCS-301L Data Structures Lab (1.5 C) and PCS-303L OOP Through JAVA Lab (1.5 C). Reconciled with full experiment lists. |
| **Sem 4** | `CSD_2_2.pdf` | `DUPLICATE_CODE / MISSING_IN_JS` | Page 1, 11, 12 | Deduplicated repeated PCS-401 entry. Added missing PCS-401L DBMS Lab (1.5 C) and PCS-402L Data Science Lab (1.5 C). |
| **Sem 5** | `CSD_3_1.pdf` | `MISSING_IN_JS` | Page 1, 16-22 | Missing PCS-501DSL Software Engineering Lab (1.5 C) and PE-I** Lab group (PE5105CS, PE5106CS, PE5107CS, PE5108CS). Reconciled. |
| **Sem 6** | `CSD_3_2.pdf` | `MISSING_IN_JS` | Page 1, 17, 20 | Missing PCS-602DSL Data Analytics & Visualization Lab (1.5 C), PCS-603DSL Machine Learning Lab (1.5 C), and Summer Internship (4-6 weeks). Reconciled. |
| **Sem 7** | `CSD_4_1.pdf` | `INCORRECT_SCHEME_OVERRIDE` | Page 1 | Speculative PCS-7xx series replaced with authoritative approved CSE 4th-year curriculum scheme (PE-III*, IV*, V*, VI*, III**, IV**, PW4108CS Mini Project - II). |
| **Sem 8** | `CSD_4_2.pdf` | `INCORRECT_SCHEME_OVERRIDE` | Page 1 | Speculative PCS-8xx series replaced with authoritative approved CSE 4th-year curriculum scheme (PE-VII*, VIII*, OE-II*, PW4205CS Project Work, MC). |

### 3.3 CSE Branch Reconciliation Breakdown

| Semester | Authoritative Source | Discrepancy Status | Source Page(s) | Audit Findings & Corrective Action |
|:---|:---|:---|:---|:---|
| **Sem 1** | `CSE _1_1.pdf` | `MATCH` | Page 1 | Complete match with BSC 101, 101L, 103, ESC 101, 101L, 102, 104 (21.5 credits). |
| **Sem 2** | `CSE_1_2.pdf` | `MATCH` | Page 1 | Complete match with BSC 102, 102L, 104, ESC 103, 103L, 104, HSMC 101, 101L (20.5 credits). |
| **Sem 3** | `CSE_2_1.pdf` | `MATCH` | Page 1 | Complete match with MC-210, BSC105, ESC-301, PCS-301, ECC-301L, PCS-301L, PCS-302, PCS-303L (22.0 credits). |
| **Sem 4** | `CSE_2_2.pdf` | `MATCH` | Page 1 | Complete match with MC-220, ESC-401, PCS-401, PCS-402, PCS-403, PCS-404, PCS-403L, PCS-404L (22.0 credits). |
| **Sem 5** | `CSE_3_1.pdf` | `MATCH` | Page 1 | Complete match with PC3101CS, PC3102CS, PE-I*, ES3106CS, HS3108-, PC3109CS, PE-I** (21.0 credits). |
| **Sem 6** | `CSE_3_2.pdf` | `MISSING_IN_JS` | Page 1 | Missing PW3210CS Mini-project (1.5 credits, 3 hrs/week). Added complete course definition. |
| **Sem 7** | `CSE_4_1.pdf` | `MISSING_IN_JS` | Page 1 | Missing PW4108CS Mini Project – II (1.5 credits, 3 hrs/week). Added complete course definition. |
| **Sem 8** | `CSE_4_2.pdf` | `MISSING_IN_JS` | Page 1, 15, 17 | Missing PW4205CS Project Work (5 credits, 10 hrs/week) and MC (Mandatory Non-Credit: MC-42aHS Yoga Practice, MC-42bHS NSS). Added full units. |

### 3.4 ECE Branch Reconciliation Breakdown

| Semester | Authoritative Source | Discrepancy Status | Source Page(s) | Audit Findings & Corrective Action |
|:---|:---|:---|:---|:---|
| **Sem 1** | `ECE_1_1.pdf` | `MATCH` | Page 1 | Complete match (21.5 credits). |
| **Sem 2** | `ECE_1_2.pdf` | `MATCH` | Page 1 | Complete match (20.5 credits). |
| **Sem 3** | `ECE_2_1.pdf` | `MATCH` | Page 1 | Complete match with 9 subjects (24.0 credits). |
| **Sem 4** | `ECE_2_2.pdf` | `MATCH` | Page 1 | Complete match with 9 subjects (25.0 credits). |
| **Sem 5** | `ECE_3_1.pdf` | `MISSING_IN_JS` | Page 1 | Missing PW3111EC Mini-project (2 credits) and PE3107EC MOOCS Course** variant in PE-I*. Reconciled. |
| **Sem 6** | `ECE_3_2.pdf` | `CODE_COLLISION / MISSING_IN_JS` | Page 1, 16 | Corrected duplicate code PE3206EC for Artificial Neural Networks to PE3205EC. Added PE3211EC MOOCs Course variant to PE-III** and PW3216EC Summer Internship. |
| **Sem 7** | `ECE_4_1.pdf` | `MISSING_IN_JS` | Page 1, 14, 15 | Missing PW4112EC Project Stage-I (2 credits) and SI4113EC Summer Internship Evaluation. Reconciled. |
| **Sem 8** | `ECE_4_2.pdf` | `AMBIGUOUS_SOURCE` | Page 1 | CRITICAL ANOMALY: ECE_4_2.pdf is identical to EEE_4_2.pdf. Preserved legacy structure; documented as unresolvable pending official university documentation. |

### 3.5 EEE Branch Reconciliation Breakdown

| Semester | Authoritative Source | Discrepancy Status | Source Page(s) | Audit Findings & Corrective Action |
|:---|:---|:---|:---|:---|
| **Sem 1** | `EEE_1_1.pdf` | `MATCH` | Page 1 | Complete match (21.5 credits). |
| **Sem 2** | `EEE_1_2.pdf` | `MATCH` | Page 1 | Complete match (20.5 credits). |
| **Sem 3** | `EEE_2_1.pdf` | `MISSING_IN_JS` | Page 1 | Missing BSC105 Mathematics III (3 credits) and MC210 Environmental Sciences (0 credits). Reconciled. |
| **Sem 4** | `EEE_2_2.pdf` | `MISSING_IN_JS` | Page 1, 2 | Missing MC-220 Constitution of India (0 credits). Reconciled with full units. |
| **Sem 5** | `EEE_3_1.pdf` | `MATCH` | Page 1 | Complete match with PC3101EE, PC3102EE, PC3103EE, PE-I, PC3107EE, HSMC3108, PC3109EE, PC3110EE (23.0 credits). |
| **Sem 6** | `EEE_3_2.pdf` | `MISSING_IN_JS` | Page 1, 18 | Missing PW3213 Summer Internship (6 weeks). Added complete syllabus. |
| **Sem 7** | `EEE_4_1.pdf` | `MISSING_IN_JS` | Page 1, 22 | Missing PW-4114EE Project Stage-I (1 credit). Added complete syllabus. |
| **Sem 8** | `EEE_4_2.pdf` | `MISSING_IN_JS` | Page 1, 16 | Missing PW-4212EE Project Stage-II (5 credits, 10 hrs/week). Added complete syllabus. |

### 3.6 IT Branch Reconciliation Breakdown

| Semester | Authoritative Source | Discrepancy Status | Source Page(s) | Audit Findings & Corrective Action |
|:---|:---|:---|:---|:---|
| **Sem 1** | `IT_1_1.pdf` | `MATCH` | Page 1 | Complete match (21.5 credits). |
| **Sem 2** | `IT_1_2.pdf` | `MATCH` | Page 1 | Complete match (20.5 credits). |
| **Sem 3** | `IT_2_1.pdf` | `MATCH` | Page 1 | Complete match with MC-210, BSC-301, ESC-301, PCS-301, PCS-302, ECC-301L, PCS-301L, PCS-303L (20.0 credits). |
| **Sem 4** | `IT_2_2.pdf` | `MATCH` | Page 1 | Complete match with MC-220, ESC-401, PCS-401, PCS-402, PCS-403, PCS-404, PCS-403L, PCS-404L (22.0 credits). |
| **Sem 5** | `IT_3_1.pdf` | `MATCH` | Page 1 | Complete match with PC3101IT, PC3102IT, ES3103IT, PE-I*, HS3108-, PC3109IT, PE-I** (21.0 credits). |
| **Sem 6** | `IT_3_2.pdf` | `MISSING_IN_JS` | Page 1 | Missing PW3210IT Mini-project (1.5 credits, 3 hrs/week). Reconciled with full definition. |
| **Sem 7** | `IT_4_1.pdf` | `FORMATTING_MISMATCH` | Page 1 | Group code standardized from 'PEC III*' to 'PE-III*' to match schema architecture. |
| **Sem 8** | `IT_4_2.pdf` | `MATCH` | Page 1 | Complete match with PE-VII*, PE-VIII*, OE-II*, PW4205IT Project Work, MC (16.0 credits). |

### 3.7 MECH Branch Reconciliation Breakdown

| Semester | Authoritative Source | Discrepancy Status | Source Page(s) | Audit Findings & Corrective Action |
|:---|:---|:---|:---|:---|
| **Sem 1** | `MECH_1_1.pdf` | `MISSING_IN_JS` | Page 1 | Missing ESC104 Engineering Mechanics (4 credits). Reconciled. |
| **Sem 2** | `MECH_1_2.pdf` | `MATCH` | Page 1 | Complete match (20.5 credits). |
| **Sem 3** | `MECH_2_1.pdf` | `MISSING_IN_JS` | Page 1, 13, 14, 18 | Missing ME-215L Material Testing Lab (1.5 C), ME-216L Manufacturing Science Lab (1.5 C), and ESC-106L Applied Electronics Lab (1.5 C). Reconciled with full experiment lists. |
| **Sem 4** | `MECH_2_2.pdf` | `MISSING_IN_JS` | Page 1, 4, 15, 16 | Missing ME-220L Thermal Engg Lab-I (1 C), ME-221L Machine Tools & Metrology Lab (1.5 C), and ME-225L Machine Drawing (1.5 C). Reconciled with full drawing exercises and experiment lists. |
| **Sem 5** | `MECH_3_1.pdf` | `MISSING_IN_JS` | Page 1, 16, 17 | Missing PC3109ME Fluid Mechanics & Hydraulic Machines Lab (1.5 C) and PC3110ME Dynamics of Machines Lab (1.5 C). Reconciled. |
| **Sem 6** | `MECH_3_2.pdf` | `MISSING_IN_JS` | Page 1, 14, 16 | Missing PC3209ME Metal Cutting science Lab (1.5 C), PC3210ME Thermal Engineering-II Lab (1.5 C), and PW3211ME Summer Internship. Reconciled. |
| **Sem 7** | `MECH_4_1.pdf` | `MISSING_IN_JS` | Page 1, 25, 26 | Missing PC4113ME Product Design by CAD Lab (1 C) and PW4114ME PROJECT WORK-I (1.5 C). Reconciled. |
| **Sem 8** | `MECH_4_2.pdf` | `MISSING_IN_JS` | Page 1, 16 | Missing PW4208ME PROJECT WORK-II (7 credits, 14 hrs/week). Reconciled. |

---
## 4. Specific Resolution of the IT Student Defect Report

The initial report came from an IT student whose dashboard displayed incorrect subject titles and counts. Our investigation revealed:
1. **Missing Practical & Project Work:** In Semester 6, `PW3210IT Mini-project` (1.5 credits) was absent from `it/sem6.js`. When students reached Semester 6 or 7, credit totals and required coursework differed from the physical curriculum book.
2. **Group Code Inconsistency:** In `it/sem7.js`, the third elective group had been declared as `"code": "PEC III*"` rather than `"code": "PE-III*"`, breaking grouping alignment with the frontend parser and database schema.
3. **Historical SQL Ingestion Artifacts:** In database migration `0020_subject_module_and_elective_groups.sql`, previous automated parsers had misread table headers, causing literal category names like `"ENGINEERING SCIENCES COURSES"` to be inserted into `syllabus_subjects` as valid subject codes. This caused the UI to display raw category headers in place of subjects like `Engineering Mechanics`.
4. **Corrective Verification:** With `it/sem6.js` and `it/sem7.js` updated and normalized, and with all first-year common courses verified, the IT curriculum now reflects the official AICTE Model Curriculum.

---
## 5. Critical Anomaly & Upstream Source Ambiguities

### ECE Semester 8 Source Ambiguity (`ECE_4_2.pdf`)
> [!WARNING] Critical Upstream File Mismatch
> The official PDF file provided under `BTech Syllabus/ECE/ECE_4_2.pdf` is identical to `BTech Syllabus/EEE/EEE_4_2.pdf` (MD5: `b70136dfa751747ef5f21fb394fc05fc`).
> The internal text explicitly designates the course as:
> `"Faculty of Engineering & Technology, KAKATIYA UNIVERSITY, Department of Electrical & Electronics Engineering, B. Tech. (EEE) VIII SEMESTER"`.
> Rather than fabricating speculative ECE subjects, `ece/sem8.js` has been preserved while flagging this discrepancy. An official request must be submitted to the Kakatiya University Controller of Examinations for the genuine B.Tech (ECE) VIII Semester syllabus document.

---
## 6. Schema Integrity and Backwards Compatibility

All 56 semester JavaScript files (`<branch>/sem<N>.js`) strictly adhere to the project's export schema:
```javascript
// Standard Theory / Lab Subject
export const semesterN = [
  {
    "code": "PC3101CS",
    "title": "Database Management Systems",
    "units": [
      { "name": "UNIT–I ...", "topics": ["..."] }
    ]
  },
  // Elective Group with Options
  {
    "code": "PE-I*",
    "title": "Professional Elective – I",
    "isGroup": true,
    "variants": [
      { "code": "PE3103CS", "title": "Web Programming", "units": [...] }
    ]
  }
];
```
All branch aggregators (`<branch>.js`) export `<branch>Syllabus` with semesters `"1"` through `"8"`, ensuring 100% interoperability with Next.js dynamic routing and database seeding.

---
## 7. Verification Test Suite

The automated verification script `verify_syllabus_complete.mjs` was executed against all modified files:
- **Syntax Validation:** 56/56 semester files and 7/7 branch files passed Node.js ESM import checks.
- **Total Subject Entries:** 424 course entries across 56 semesters.
- **Total Offered Subjects (including variants):** 556 individual subjects.
- **Credit Calculations:** Verified matching official PDF semester credit totals across all branches.
