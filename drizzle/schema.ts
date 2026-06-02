import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, int, date, varchar, tinyint, timestamp, mysqlEnum, decimal, float, json, text, bigint } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const academicCalendar = mysqlTable("academic_calendar", {
	id: int().autoincrement().notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	date: date({ mode: 'string' }).notNull(),
	academicYear: varchar("academic_year", { length: 9 }).notNull(),
	semester: tinyint().notNull(),
	holidayName: varchar("holiday_name", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
	dayType: mysqlEnum("day_type", ['WORKING','HOLIDAY','EXAM','INTERNAL','EVENT']).default('WORKING').notNull(),
},
(table) => [
	index("idx_date").on(table.date),
	index("idx_ay_sem").on(table.academicYear, table.semester),
]);

export const attendanceSessionLogs = mysqlTable("attendance_session_logs", {
	id: int().autoincrement().notNull(),
	sessionId: int("session_id").notNull(),
	studentId: int("student_id").notNull(),
	deviceHash: varchar("device_hash", { length: 255 }),
	ipAddress: varchar("ip_address", { length: 45 }),
	uaHash: varchar("ua_hash", { length: 32 }),
	status: mysqlEnum(['SUCCESS','FAILED_LOCATION','FAILED_EXPIRED','FAILED_PIN','LOCKED']).default('SUCCESS'),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("idx_session_ip_ua").on(table.sessionId, table.ipAddress, table.uaHash),
]);

export const attendanceSessions = mysqlTable("attendance_sessions", {
	id: int().autoincrement().notNull(),
	assignmentId: int("assignment_id").notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	attendanceDate: date("attendance_date", { mode: 'string' }),
	facultyId: int("faculty_id").notNull(),
	sessionPin: varchar("session_pin", { length: 4 }).notNull(),
	sessionToken: varchar("session_token", { length: 64 }).notNull(),
	latitude: decimal({ precision: 10, scale: 8 }),
	longitude: decimal({ precision: 11, scale: 8 }),
	isActive: tinyint("is_active").default(1),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	sessionNumber: int("session_number").default(1),
	accuracy: float(),
},
(table) => [
	index("idx_assignment_active").on(table.assignmentId, table.isActive),
	index("idx_sessions_active").on(table.isActive, table.expiresAt),
]);

export const auditLogs = mysqlTable("audit_logs", {
	id: int().autoincrement().notNull(),
	userId: int("user_id"),
	userType: mysqlEnum("user_type", ['admin','clerk','student','system']).notNull(),
	action: varchar({ length: 100 }).notNull(),
	targetId: varchar("target_id", { length: 255 }),
	targetType: varchar("target_type", { length: 100 }),
	payloadBefore: json("payload_before"),
	payloadAfter: json("payload_after"),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("idx_audit_action").on(table.action),
	index("idx_audit_user").on(table.userId, table.userType),
	index("idx_audit_target").on(table.targetId, table.targetType),
]);

export const branchConfig = mysqlTable("branch_config", {
	id: int().autoincrement().notNull(),
	branch: varchar({ length: 50 }).notNull(),
	academicYear: varchar("academic_year", { length: 9 }).notNull(),
	semester: tinyint().notNull(),
	midMax: int("mid_max").default(20),
	assignmentMax: int("assignment_max").default(10),
	isLocked: tinyint("is_locked").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
});

export const branchTimetable = mysqlTable("branch_timetable", {
	id: int().autoincrement().notNull(),
	branch: varchar({ length: 50 }).notNull(),
	semester: tinyint().notNull(),
	section: varchar({ length: 5 }).default('A'),
	dayOfWeek: mysqlEnum("day_of_week", ['MON','TUE','WED','THU','FRI','SAT']).notNull(),
	periodNumber: int("period_number").notNull(),
	subjectCode: varchar("subject_code", { length: 50 }),
	facultyId: int("faculty_id"),
	academicYear: varchar("academic_year", { length: 9 }).notNull(),
	roomNo: varchar("room_no", { length: 20 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
	version: int().default(1).notNull(),
},
(table) => [
	index("idx_timetable_lookup").on(table.branch, table.semester, table.academicYear),
]);

export const bugReports = mysqlTable("bug_reports", {
	id: int().autoincrement().notNull(),
	description: text().notNull(),
	screenshotUrl: text("screenshot_url"),
	status: mysqlEnum(['OPEN','RESOLVED','CLOSED']).default('OPEN').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
	severity: mysqlEnum(['CRITICAL','HIGH','MEDIUM','LOW']).default('MEDIUM').notNull(),
	submittedBy: varchar("submitted_by", { length: 255 }).notNull(),
	userType: mysqlEnum("user_type", ['student','clerk','admin']).notNull(),
	affectedPage: varchar("affected_page", { length: 255 }),
	browserInfo: text("browser_info"),
	type: mysqlEnum(['BUG','FEATURE_REQUEST']).default('BUG').notNull(),
	fixedBy: varchar("fixed_by", { length: 255 }),
	fixedAt: timestamp("fixed_at", { mode: 'string' }),
},
(table) => [
	index("idx_bug_status").on(table.status),
	index("idx_bug_created_at").on(table.createdAt),
	index("idx_bug_severity").on(table.severity),
	index("idx_bug_submitted_by").on(table.submittedBy),
	index("idx_bug_type").on(table.type),
]);

export const certificateVerifications = mysqlTable("certificate_verifications", {
	id: int().autoincrement().notNull(),
	requestId: int("request_id").notNull(),
	verificationDate: timestamp("verification_date", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: text("user_agent"),
	deviceName: varchar("device_name", { length: 255 }),
	locationName: varchar("location_name", { length: 255 }),
	latitude: decimal({ precision: 10, scale: 8 }),
	longitude: decimal({ precision: 11, scale: 8 }),
});

export const certificateVerificationsArchive = mysqlTable("certificate_verifications_archive", {
	id: int().notNull(),
	requestId: int("request_id").notNull(),
	verificationDate: timestamp("verification_date", { mode: 'string' }).notNull(),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: text("user_agent"),
	deviceName: varchar("device_name", { length: 255 }),
	locationName: varchar("location_name", { length: 255 }),
	latitude: decimal({ precision: 10, scale: 8 }),
	longitude: decimal({ precision: 11, scale: 8 }),
	archivedAt: timestamp("archived_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const clerks = mysqlTable("clerks", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	employeeId: varchar("employee_id", { length: 255 }),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	role: varchar({ length: 50 }).default('scholarship').notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
	isHod: tinyint("is_hod").default(0),
	branch: varchar({ length: 50 }),
	mobile: varchar({ length: 255 }),
	mobileHash: varchar("mobile_hash", { length: 64 }),
	pfp: text(),
	signature: text(),
	address: text(),
	lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
	lastLoginIp: varchar("last_login_ip", { length: 64 }),
	passwordChangedAt: timestamp("password_changed_at", { mode: 'string' }),
});

export const collegeInfo = mysqlTable("college_info", {
	id: int().autoincrement().notNull(),
	firstSemStartMonth: tinyint("first_sem_start_month"),
	firstSemStartDay: tinyint("first_sem_start_day"),
	secondSemStartMonth: tinyint("second_sem_start_month"),
	secondSemStartDay: tinyint("second_sem_start_day"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
	name: varchar({ length: 255 }).default('KU COLLEGE OF ENGINEERING & TECHNOLOGY'),
	shortName: varchar("short_name", { length: 50 }).default('KUCET'),
	address: text(),
	location: varchar({ length: 100 }).default('Warangal'),
	pincode: varchar({ length: 10 }).default('506009'),
	contact: varchar({ length: 100 }).default('0870-2970125'),
	entranceCodes: json("entrance_codes"),
	branches: json(),
	categories: json(),
	annualIncomes: json("annual_incomes"),
	maintenanceMode: tinyint("maintenance_mode").default(0).notNull(),
});

export const facultySubjectAssignments = mysqlTable("faculty_subject_assignments", {
	id: int().autoincrement().notNull(),
	facultyId: int("faculty_id").notNull(),
	subjectCode: varchar("subject_code", { length: 50 }).notNull(),
	subjectName: varchar("subject_name", { length: 255 }).notNull(),
	branch: varchar({ length: 50 }).notNull(),
	courseSemester: tinyint("course_semester").notNull(),
	academicTerm: tinyint("academic_term").notNull(),
	academicYear: varchar("academic_year", { length: 9 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	isActive: tinyint("is_active").default(1),
	midMax: int("mid_max").default(20),
},
(table) => [
	index("idx_faculty_subject_active").on(table.branch, table.isActive),
	index("idx_fsa_branch_sem").on(table.branch, table.courseSemester),
]);

export const facultySubjectInterests = mysqlTable("faculty_subject_interests", {
	id: int().autoincrement().notNull(),
	facultyId: int("faculty_id").notNull(),
	subjectCode: varchar("subject_code", { length: 50 }).notNull(),
	subjectName: varchar("subject_name", { length: 255 }).notNull(),
	branch: varchar({ length: 50 }).notNull(),
	semester: int().notNull(),
	academicYear: varchar("academic_year", { length: 9 }).notNull(),
	status: mysqlEnum(['PENDING','APPROVED','REJECTED']).default('PENDING').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
});

export const facultySubstitutions = mysqlTable("faculty_substitutions", {
	id: int().autoincrement().notNull(),
	originalAssignmentId: int("original_assignment_id").notNull(),
	substituteFacultyId: int("substitute_faculty_id").notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	substitutionDate: date("substitution_date", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	createdByClerkId: int("created_by_clerk_id"),
});

export const otpCodes = mysqlTable("otp_codes", {
	id: int().autoincrement().notNull(),
	identifier: varchar({ length: 255 }).notNull(),
	otpCode: varchar("otp_code", { length: 6 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
},
(table) => [
	index("idx_otp_identifier").on(table.identifier),
]);

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	tokenHash: varchar("token_hash", { length: 255 }).notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	userType: mysqlEnum("user_type", ['student','clerk','admin']).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { mode: 'string' }),
},
(table) => [
	index("idx_password_reset_user").on(table.userId, table.userType),
	index("idx_password_reset_expiry").on(table.expiresAt),
]);

export const principal = mysqlTable("principal", {
	id: int().autoincrement().notNull(),
	email: varchar({ length: 255 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const rateLimits = mysqlTable("rate_limits", {
	keyName: varchar("key_name", { length: 255 }).notNull(),
	points: int().default(0),
	expireAt: timestamp("expire_at", { mode: 'string' }).notNull(),
},
(table) => [
	index("idx_expire").on(table.expireAt),
]);

export const refreshTokens = mysqlTable("refresh_tokens", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	tokenHash: varchar("token_hash", { length: 255 }).notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	userType: mysqlEnum("user_type", ['student','clerk','admin']).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	revokedAt: timestamp("revoked_at", { mode: 'string' }),
	replacedByTokenId: bigint("replaced_by_token_id", { mode: "number", unsigned: true }),
},
(table) => [
	index("idx_refresh_token_hash").on(table.tokenHash),
	index("idx_refresh_user").on(table.userId, table.userType),
]);

export const scholarshipSanctions = mysqlTable("scholarship_sanctions", {
	id: int().autoincrement().notNull(),
	studentId: int("student_id").notNull(),
	academicYear: varchar("academic_year", { length: 9 }).notNull(),
	applicationNo: varchar("application_no", { length: 255 }).notNull(),
	proceedingNo: varchar("proceeding_no", { length: 255 }),
	sanctionedAmount: decimal("sanctioned_amount", { precision: 10, scale: 2 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	sanctionDate: date("sanction_date", { mode: 'string' }),
	releasedAmount: decimal("released_amount", { precision: 10, scale: 2 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	releasedDate: date("released_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
	thumbUpdateAvailable: tinyint("thumb_update_available").default(0),
	thumbStatus: mysqlEnum("thumb_status", ['PENDING','COMPLETE']).default('PENDING'),
	hardcopySubmitted: tinyint("hardcopy_submitted").default(0),
	status: mysqlEnum(['PENDING','SANCTIONED','RELEASED','REJECTED']).default('PENDING'),
},
(table) => [
	index("idx_scholarship_app_year").on(table.applicationNo, table.academicYear),
	index("idx_scholarship_search").on(table.studentId, table.academicYear),
]);

export const scholarshipWindows = mysqlTable("scholarship_windows", {
	id: int().autoincrement().notNull(),
	academicYear: varchar("academic_year", { length: 9 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	startDate: date("start_date", { mode: 'string' }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	endDate: date("end_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
});

export const securityEvents = mysqlTable("security_events", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	userType: mysqlEnum("user_type", ['STUDENT','CLERK','FACULTY','HOD','ADMIN']).notNull(),
	userId: bigint("user_id", { mode: "number" }).notNull(),
	eventType: varchar("event_type", { length: 50 }).notNull(),
	ipAddress: varchar("ip_address", { length: 64 }),
	details: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("idx_user").on(table.userType, table.userId),
	index("idx_event_type").on(table.eventType),
	index("idx_created_at").on(table.createdAt),
]);

export const securityNotifications = mysqlTable("security_notifications", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	userType: mysqlEnum("user_type", ['STUDENT','CLERK','FACULTY','HOD','ADMIN']).notNull(),
	userId: bigint("user_id", { mode: "number" }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	severity: mysqlEnum(['INFO','WARNING','CRITICAL']).default('INFO'),
	isRead: tinyint("is_read").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("idx_user").on(table.userType, table.userId),
	index("idx_read").on(table.isRead),
]);

export const semesters = mysqlTable("semesters", {
	id: int().autoincrement().notNull(),
	academicYear: varchar("academic_year", { length: 9 }).notNull(),
	semester: tinyint().notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	startDate: date("start_date", { mode: 'string' }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	endDate: date("end_date", { mode: 'string' }).notNull(),
	weekendPattern: json("weekend_pattern").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
});

export const studentAcademicBackground = mysqlTable("student_academic_background", {
	id: int().autoincrement().notNull(),
	studentId: int("student_id").notNull(),
	qualifyingExam: varchar("qualifying_exam", { length: 50 }),
	previousCollegeDetails: text("previous_college_details"),
	mediumOfInstruction: varchar("medium_of_instruction", { length: 50 }),
	ranks: int(),
	sscMarks: varchar("ssc_marks", { length: 50 }),
	interMarks: varchar("inter_marks", { length: 50 }),
});

export const studentAdmissionDrafts = mysqlTable("student_admission_drafts", {
	id: int().autoincrement().notNull(),
	status: mysqlEnum(['DRAFT','PROCESSED','FINALIZED']).default('DRAFT').notNull(),
	admissionYear: varchar("admission_year", { length: 9 }).notNull(),
	entranceExam: varchar("entrance_exam", { length: 10 }).notNull(),
	branch: varchar({ length: 50 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	fatherName: varchar("father_name", { length: 255 }),
	motherName: varchar("mother_name", { length: 255 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	dob: date({ mode: 'string' }),
	gender: varchar({ length: 10 }),
	email: varchar({ length: 255 }),
	studentMobile: varchar("student_mobile", { length: 255 }),
	guardianMobile: varchar("guardian_mobile", { length: 255 }),
	pfp: text(),
	signature: text(),
	examRank: int("exam_rank"),
	areaStatus: varchar("area_status", { length: 50 }),
	category: varchar({ length: 50 }),
	subCaste: varchar("sub_caste", { length: 100 }),
	seatAllottedCategory: varchar("seat_allotted_category", { length: 100 }),
	sscMarks: varchar("ssc_marks", { length: 50 }),
	interDiplomaMarks: varchar("inter_diploma_marks", { length: 50 }),
	nationality: varchar({ length: 100 }),
	religion: varchar({ length: 100 }),
	motherTongue: varchar("mother_tongue", { length: 100 }),
	bloodGroup: varchar("blood_group", { length: 10 }),
	placeOfBirth: varchar("place_of_birth", { length: 255 }),
	fatherOccupation: varchar("father_occupation", { length: 255 }),
	annualIncome: varchar("annual_income", { length: 50 }),
	aadhaarNo: varchar("aadhaar_no", { length: 255 }),
	feeReimbursement: mysqlEnum("fee_reimbursement", ['YES','NO','GOV']),
	identificationMark1: text("identification_mark_1"),
	identificationMark2: text("identification_mark_2"),
	permanentAddress: text("permanent_address"),
	rollNo: varchar("roll_no", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
	mobileHash: varchar("mobile_hash", { length: 64 }),
	aadhaarHash: varchar("aadhaar_hash", { length: 64 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	admissionDate: date("admission_date", { mode: 'string' }),
},
(table) => [
	index("idx_draft_mobile_hash").on(table.mobileHash),
	index("idx_draft_aadhaar_hash").on(table.aadhaarHash),
]);

export const studentAttendance = mysqlTable("student_attendance", {
	id: int().autoincrement().notNull(),
	studentId: int("student_id").notNull(),
	assignmentId: int("assignment_id").notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	date: date({ mode: 'string' }).notNull(),
	session: int().notNull(),
	status: mysqlEnum(['PRESENT','ABSENT','NCC','MEDICAL']).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("idx_attendance_lookup").on(table.assignmentId, table.date, table.session),
	index("idx_student_attendance_history").on(table.studentId, table.date),
]);

export const studentFeePayments = mysqlTable("student_fee_payments", {
	id: int().autoincrement().notNull(),
	studentId: int("student_id").notNull(),
	academicYear: varchar("academic_year", { length: 9 }).notNull(),
	amount: decimal({ precision: 10, scale: 2 }).notNull(),
	transactionRefNo: varchar("transaction_ref_no", { length: 255 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	transactionDate: date("transaction_date", { mode: 'string' }).notNull(),
	paymentMode: varchar("payment_mode", { length: 50 }),
	bankName: varchar("bank_name", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
});

export const studentImages = mysqlTable("student_images", {
	studentId: int("student_id").notNull(),
	pfp: text(),
});

export const studentImportLogs = mysqlTable("student_import_logs", {
	id: int().autoincrement().notNull(),
	clerkId: int("clerk_id").notNull(),
	totalRecords: int("total_records").notNull(),
	fileName: varchar("file_name", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("idx_import_created_at").on(table.createdAt),
]);

export const studentMarks = mysqlTable("student_marks", {
	id: int().autoincrement().notNull(),
	studentId: int("student_id").notNull(),
	assignmentId: int("assignment_id").notNull(),
	mid1Marks: decimal("mid1_marks", { precision: 5, scale: 2 }),
	mid2Marks: decimal("mid2_marks", { precision: 5, scale: 2 }),
	assignmentMarks: decimal("assignment_marks", { precision: 5, scale: 2 }),
	labTheoryMarks: decimal("lab_theory_marks", { precision: 5, scale: 2 }),
	labExecutionMarks: decimal("lab_execution_marks", { precision: 5, scale: 2 }),
	labRecordMarks: decimal("lab_record_marks", { precision: 5, scale: 2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
	isPublished: tinyint("is_published").default(1).notNull(),
	version: int().default(1).notNull(),
});

export const studentPersonalDetails = mysqlTable("student_personal_details", {
	id: int().autoincrement().notNull(),
	studentId: int("student_id").notNull(),
	fatherName: varchar("father_name", { length: 255 }),
	motherName: varchar("mother_name", { length: 255 }),
	nationality: varchar({ length: 100 }),
	religion: varchar({ length: 100 }),
	category: varchar({ length: 50 }),
	subCaste: varchar("sub_caste", { length: 100 }),
	areaStatus: mysqlEnum("area_status", ['Local','Non-Local']),
	motherTongue: varchar("mother_tongue", { length: 100 }),
	placeOfBirth: varchar("place_of_birth", { length: 255 }),
	fatherOccupation: varchar("father_occupation", { length: 255 }),
	guardianMobile: varchar("guardian_mobile", { length: 255 }),
	annualIncome: varchar("annual_income", { length: 50 }),
	aadhaarNo: varchar("aadhaar_no", { length: 255 }),
	address: text(),
	seatAllottedCategory: varchar("seat_allotted_category", { length: 100 }),
	identificationMarks: text("identification_marks"),
	bloodGroup: mysqlEnum("blood_group", ['A+','A-','B+','B-','AB+','AB-','O+','O-']),
	aadhaarHash: varchar("aadhaar_hash", { length: 64 }),
},
(table) => [
	index("idx_spd_aadhaar_hash").on(table.aadhaarHash),
]);

export const studentProfileRequests = mysqlTable("student_profile_requests", {
	id: int().autoincrement().notNull(),
	studentId: int("student_id").notNull(),
	newSignature: text("new_signature"),
	newPfp: text("new_pfp"),
	newData: json("new_data"),
	proofUrl: text("proof_url"),
	status: mysqlEnum(['pending','approved','rejected']).default('pending'),
	rejectionReason: text("rejection_reason"),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
});

export const studentRequestImages = mysqlTable("student_request_images", {
	requestId: int("request_id").notNull(),
	paymentScreenshot: text("payment_screenshot"),
});

export const studentRequests = mysqlTable("student_requests", {
	requestId: int("request_id").autoincrement().notNull(),
	studentId: int("student_id").notNull(),
	certificateType: varchar("certificate_type", { length: 100 }).notNull(),
	purpose: text(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	fromDate: date("from_date", { mode: 'string' }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	toDate: date("to_date", { mode: 'string' }),
	generatedCertificateId: varchar("generated_certificate_id", { length: 50 }),
	academicYear: varchar("academic_year", { length: 9 }).notNull(),
	status: mysqlEnum(['PENDING','APPROVED','REJECTED']).default('PENDING').notNull(),
	paymentAmount: int("payment_amount").notNull(),
	transactionId: varchar("transaction_id", { length: 100 }),
	paymentScreenshot: text("payment_screenshot"),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	rejectReason: text("reject_reason"),
	generatedAttendance: varchar("generated_attendance", { length: 10 }),
	actionByClerkId: int("action_by_clerk_id"),
	actionByRole: varchar("action_by_role", { length: 50 }),
},
(table) => [
	index("idx_gen_cert_id").on(table.generatedCertificateId),
]);

export const studentSignatures = mysqlTable("student_signatures", {
	studentId: int("student_id").notNull(),
	signature: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
});

export const students = mysqlTable("students", {
	id: int().autoincrement().notNull(),
	admissionNo: varchar("admission_no", { length: 255 }),
	rollNo: varchar("roll_no", { length: 255 }),
	feeReimbursement: mysqlEnum("fee_reimbursement", ['YES','NO']).default('NO').notNull(),
	name: varchar({ length: 255 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	dateOfBirth: date("date_of_birth", { mode: 'string' }),
	gender: varchar({ length: 50 }),
	mobile: varchar({ length: 255 }),
	email: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	isEmailVerified: tinyint("is_email_verified").default(0).notNull(),
	emailVerifiedAt: timestamp("email_verified_at", { mode: 'string' }),
	passwordHash: varchar("password_hash", { length: 255 }),
	addedByClerkId: int("added_by_clerk_id"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).onUpdateNow(),
	updatedByClerkId: int("updated_by_clerk_id"),
	studentStatus: mysqlEnum("student_status", ['ACTIVE','DISCONTINUED']).default('ACTIVE'),
	mobileHash: varchar("mobile_hash", { length: 64 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	admissionDate: date("admission_date", { mode: 'string' }),
	academicStatus: mysqlEnum("academic_status", ['REGULAR','DETAINED','DROPPED','GRADUATED']).default('REGULAR'),
	academicOffsetYears: int("academic_offset_years").default(0),
	lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
	lastLoginIp: varchar("last_login_ip", { length: 64 }),
	passwordChangedAt: timestamp("password_changed_at", { mode: 'string' }),
},
(table) => [
	index("idx_roll_no").on(table.rollNo),
	index("idx_students_created_at").on(table.createdAt),
	index("idx_students_mobile_hash").on(table.mobileHash),
]);

export const syllabusStructure = mysqlTable("syllabus_structure", {
	id: int().autoincrement().notNull(),
	branch: varchar({ length: 50 }).notNull(),
	semester: tinyint().notNull(),
	subjectCode: varchar("subject_code", { length: 50 }).notNull(),
	isGroup: tinyint("is_group").default(0),
	parentGroupCode: varchar("parent_group_code", { length: 50 }),
},
(table) => [
	index("branch").on(table.branch, table.semester),
	index("subject_code").on(table.subjectCode),
]);

export const syllabusSubjects = mysqlTable("syllabus_subjects", {
	subjectCode: varchar("subject_code", { length: 50 }).notNull(),
	subjectName: varchar("subject_name", { length: 255 }).notNull(),
	subjectType: mysqlEnum("subject_type", ['theory','lab']).notNull(),
});

export const userSessions = mysqlTable("user_sessions", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	userType: mysqlEnum("user_type", ['STUDENT','CLERK','FACULTY','HOD','ADMIN']).notNull(),
	userId: bigint("user_id", { mode: "number" }).notNull(),
	sessionTokenHash: varchar("session_token_hash", { length: 255 }).notNull(),
	deviceName: varchar("device_name", { length: 255 }),
	browser: varchar({ length: 100 }),
	operatingSystem: varchar("operating_system", { length: 100 }),
	ipAddress: varchar("ip_address", { length: 64 }),
	location: varchar({ length: 255 }),
	isCurrent: tinyint("is_current").default(0),
	isRevoked: tinyint("is_revoked").default(0),
	lastSeenAt: timestamp("last_seen_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
},
(table) => [
	index("idx_user").on(table.userType, table.userId),
	index("idx_active").on(table.isRevoked, table.lastSeenAt),
]);
