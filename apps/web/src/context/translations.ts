export type Language = "en" | "kn" | "hi";

export interface Translations {
  // Navigation & Brand
  brandTagline: string;
  findWork: string;
  myShifts: string;
  postWork: string;
  myPostings: string;
  myApplications: string;
  dashboard: string;
  logIn: string;
  getStarted: string;
  logOut: string;
  networkLive: string;
  profile: string;
  messages: string;
  notifications: string;
  home: string;
  shifts: string;
  workers: string;
  myWork: string;
  findJobs: string;
  admin: string;
  earnings: string;
  wageSettlements: string;
  commandCenter: string;
  marketplace: string;

  // Auth & Roles
  phoneLabel: string;
  passwordLabel: string;
  fullNameLabel: string;
  enterPhone: string;
  enterPassword: string;
  enterFullName: string;
  roleWorker: string;
  roleProvider: string;
  roleAgent: string;
  workerDesc: string;
  providerDesc: string;
  agentDesc: string;
  loginTitle: string;
  loginSubtitle: string;
  registerTitle: string;
  registerSubtitle: string;
  dontHaveAccount: string;
  alreadyHaveAccount: string;
  createAccount: string;
  loginBtn: string;
  invalidCredentials: string;

  // Discovery & Job Cards
  workWithinReach: string;
  discoverySubtitle: string;
  searchPlaceholder: string;
  voiceSearchListening: string;
  voiceSearchTooltip: string;
  listenToJob: string;
  stopListening: string;
  searchWork: string;
  allTypes: string;
  task: string;
  shift: string;
  job: string;
  recommended: string;
  nearest: string;
  highestPay: string;
  fixedPayout: string;
  perHour: string;
  match: string;
  distanceAway: string;
  applyNow: string;
  viewDetails: string;
  applied: string;
  noJobsFound: string;
  expandRadius: string;
  timing: string;
  wage: string;
  duration: string;
  location: string;
  requirements: string;
  urgent: string;
  startingSoon: string;
  hours: string;
  kmAway: string;
  distance: string;
  schedule: string;
  employer: string;
  locateOnMap: string;
  directions: string;
  filterAll: string;
  filterActive: string;
  filterCompleted: string;

  // Applications & Hiring
  submitApplication: string;
  proposedWage: string;
  applicationPending: string;
  shortlisted: string;
  accepted: string;
  rejected: string;
  confirmAttendance: string;
  hired: string;
  agentAssisted: string;
  assistedByAgent: string;
  statusPendingReview: string;
  statusShortlisted: string;
  statusDeclined: string;
  statusWithdrawn: string;
  withdrawApplication: string;
  withdrawPrompt: string;
  withdrawSuccess: string;
  applicationsTitle: string;
  applicationsSubtitle: string;
  exploreWork: string;

  // Assignments & Shift Execution
  myActiveShifts: string;
  checkIn: string;
  checkOut: string;
  arrivedAtLocation: string;
  verifyingGps: string;
  gpsVerified: string;
  gpsFailed: string;
  enterPin: string;
  jobPin: string;
  shiftCompleted: string;
  statusAssigned: string;
  statusConfirmed: string;
  statusCheckedIn: string;
  statusInProgress: string;
  statusCompleted: string;
  statusClosed: string;
  shiftDispatch: string;
  hiredTapToConfirm: string;
  confirmedReadyForArrival: string;
  shiftInProgress: string;
  shiftCompletedBadge: string;
  confirmAttendancePrompt: string;
  enterPinToVerify: string;

  // Payments & Settlement
  settlementPending: string;
  cashPayment: string;
  onlinePayment: string;
  payWorker: string;
  paymentPin: string;
  paymentReceipt: string;
  paid: string;
  amountPaid: string;
  wageBreakdown: string;
  downloadReceipt: string;
  cashHandoverNotice: string;
  settlementPin: string;
  enterPinToConfirm: string;
  generatePin: string;
  copyPin: string;
  pinCopied: string;
  confirmCashReceipt: string;
  handoverCashPrompt: string;
  paymentCompleted: string;
  earningsToday: string;
  earningsMonth: string;
  totalEarnings: string;

  // Worker Actions & Status
  availableNow: string;
  goOffline: string;
  inProgress: string;
  pending: string;

  // Safety & Assistance
  safetyCenter: string;
  reportIssue: string;
  emergencyNotice: string;
  fileDispute: string;
  disputePending: string;
  disputeResolved: string;
  nationalEmergency112: string;
  womenHelpline1091: string;
  policeAmbulance: string;
  safetyHelplineTitle: string;
  safetyHelplineDesc: string;

  // Agent Marketplace
  agentPortal: string;
  connectWorker: string;
  activeWorkers: string;
  assistedApplications: string;
  consentNotice: string;

  // Messaging & Notifications
  noConversations: string;
  typeMessage: string;
  send: string;
  markAllAsRead: string;
  noNotifications: string;
  unread: string;

  // Common Actions & Errors
  save: string;
  cancel: string;
  confirm: string;
  back: string;
  close: string;
  loading: string;
  retry: string;
  error: string;
  success: string;
  somethingWentWrong: string;
  requiredField: string;

  // Language Names
  english: string;
  kannada: string;
  hindi: string;
}

export const TRANSLATIONS: Record<Language, Translations> = {
  en: {
    // Navigation & Brand
    brandTagline: "Work Within Reach",
    findWork: "Find Work (5 KM)",
    myShifts: "My Shifts",
    postWork: "Post Work",
    myPostings: "My Postings",
    myApplications: "My Applications",
    dashboard: "Dashboard",
    logIn: "Log In",
    getStarted: "Get Started",
    logOut: "Log Out",
    networkLive: "5 KM Live Network",
    profile: "My Profile",
    messages: "Messages",
    notifications: "Notifications",
    home: "Home",
    shifts: "Shifts",
    workers: "Workers",
    myWork: "My Work",
    findJobs: "Find Jobs",
    admin: "Admin",
    earnings: "Earnings",
    wageSettlements: "Wage Settlements",
    commandCenter: "Command Center",
    marketplace: "Marketplace",

    // Auth & Roles
    phoneLabel: "Phone Number",
    passwordLabel: "Password",
    fullNameLabel: "Full Name",
    enterPhone: "Enter 10-digit mobile number",
    enterPassword: "Enter your password",
    enterFullName: "Enter your full name",
    roleWorker: "Worker (Looking for Work)",
    roleProvider: "Employer (Hiring Help)",
    roleAgent: "Agent (Assisting Workers)",
    workerDesc: "Find quick daily jobs and shifts near you with same-day pay.",
    providerDesc: "Hire verified local workers for immediate shifts and tasks.",
    agentDesc: "Help local workers with limited digital access find jobs.",
    loginTitle: "Welcome Back",
    loginSubtitle: "Sign in to access your NearVia account",
    registerTitle: "Create Account",
    registerSubtitle: "Join your local 5 KM work network",
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    createAccount: "Sign Up",
    loginBtn: "Sign In",
    invalidCredentials: "Invalid phone number or password.",

    // Discovery & Job Cards
    workWithinReach: "Work Within Reach",
    discoverySubtitle: "Real-time tasks, shifts, and jobs with same-day settlement around your location.",
    searchPlaceholder: "Search by trade, skill or task (e.g. bakery helper, cleaning, repair)...",
    voiceSearchListening: "Listening... speak now",
    voiceSearchTooltip: "Tap to search by voice",
    listenToJob: "Read job details aloud",
    stopListening: "Stop listening",
    searchWork: "Search Work",
    allTypes: "All Types",
    task: "Task (1–3h)",
    shift: "Shift (4–8h)",
    job: "Job (1+ Days)",
    recommended: "Best Match",
    nearest: "Nearest",
    highestPay: "Highest Pay",
    fixedPayout: "Fixed Payout",
    perHour: "/ hour",
    match: "Match",
    distanceAway: "away",
    applyNow: "Quick Apply",
    viewDetails: "View Details",
    applied: "Applied",
    noJobsFound: "No opportunities found within selected radius",
    expandRadius: "Expand to 5 KM",
    timing: "Shift Timing",
    wage: "Wage & Payout",
    duration: "Duration",
    location: "Job Location",
    requirements: "Requirements",
    urgent: "URGENT",
    startingSoon: "STARTING SOON",
    hours: "Hours",
    kmAway: "km away",
    distance: "Distance",
    schedule: "Schedule",
    employer: "Employer",
    locateOnMap: "Locate on Map",
    directions: "Directions",
    filterAll: "All",
    filterActive: "Active",
    filterCompleted: "Completed",

    // Applications & Hiring
    submitApplication: "Apply for Job",
    proposedWage: "Proposed Wage",
    applicationPending: "Under Review",
    shortlisted: "Shortlisted",
    accepted: "Hired 🎉",
    rejected: "Not Selected",
    confirmAttendance: "Confirm Attendance",
    hired: "Hired 🎉",
    agentAssisted: "Agent-Assisted",
    assistedByAgent: "Assisted by trusted local Agent",
    statusPendingReview: "Pending Review",
    statusShortlisted: "Shortlisted ✨",
    statusDeclined: "Declined",
    statusWithdrawn: "Withdrawn",
    withdrawApplication: "Withdraw Application",
    withdrawPrompt: "Are you sure you want to withdraw this application?",
    withdrawSuccess: "Application successfully withdrawn.",
    applicationsTitle: "Your Work Applications",
    applicationsSubtitle: "Track status, shortlisted notifications, and employer selections in real-time.",
    exploreWork: "Explore 5 KM Work",

    // Assignments & Shift Execution
    myActiveShifts: "My Active Shifts",
    checkIn: "Arrive & Check In",
    checkOut: "Complete & Check Out",
    arrivedAtLocation: "I Have Arrived",
    verifyingGps: "Verifying GPS location...",
    gpsVerified: "Location Verified",
    gpsFailed: "Please stand within 500m of the job location",
    enterPin: "Enter 4-Digit Job PIN",
    jobPin: "Job PIN",
    shiftCompleted: "Shift Completed",
    statusAssigned: "Assigned",
    statusConfirmed: "Confirmed",
    statusCheckedIn: "Checked In",
    statusInProgress: "In Progress",
    statusCompleted: "Completed",
    statusClosed: "Settled & Closed",
    shiftDispatch: "Shift Dispatch & Execution",
    hiredTapToConfirm: "🎉 Hired • Tap to Confirm",
    confirmedReadyForArrival: "Confirmed • Ready for Arrival",
    shiftInProgress: "Shift In Progress",
    shiftCompletedBadge: "Shift Completed",
    confirmAttendancePrompt: "Please confirm your attendance",
    enterPinToVerify: "Enter 4-digit PIN for verification",

    // Payments & Settlement
    settlementPending: "Settlement Pending",
    cashPayment: "Cash Handover",
    onlinePayment: "Online Payment (UPI/Card)",
    payWorker: "Pay Worker",
    paymentPin: "Settlement PIN",
    paymentReceipt: "Payment Receipt",
    paid: "Paid",
    amountPaid: "Amount Paid",
    wageBreakdown: "Wage Breakdown",
    downloadReceipt: "Download Receipt",
    cashHandoverNotice: "Hand over cash in person upon work completion and obtain verification PIN.",
    settlementPin: "Settlement PIN",
    enterPinToConfirm: "Enter PIN to Confirm",
    generatePin: "Generate PIN",
    copyPin: "Copy PIN",
    pinCopied: "PIN Copied!",
    confirmCashReceipt: "Confirm Cash Receipt",
    handoverCashPrompt: "Hand over exact cash amount to the worker.",
    paymentCompleted: "Payment Completed",
    earningsToday: "Today's Earnings",
    earningsMonth: "This Month's Earnings",
    totalEarnings: "Total Earnings",

    // Worker Actions & Status
    availableNow: "Available Now",
    goOffline: "Turn Offline",
    inProgress: "In Progress",
    pending: "Pending",

    // Safety & Assistance
    safetyCenter: "Safety Center",
    reportIssue: "Report an Issue",
    emergencyNotice: "In immediate danger, please dial 112 (Emergency Services).",
    fileDispute: "File a Dispute",
    disputePending: "Dispute Under Investigation",
    disputeResolved: "Dispute Resolved",
    nationalEmergency112: "National Emergency: 112",
    womenHelpline1091: "Women Helpline: 1091",
    policeAmbulance: "Police: 100 / Ambulance: 108",
    safetyHelplineTitle: "NEARVIA 24/7 Safety & Emergency Guidance",
    safetyHelplineDesc: "NEARVIA strictly moderates fraud, harassment, and wage issues. For immediate physical danger or medical emergencies, contact emergency services.",

    // Agent Marketplace
    agentPortal: "Agent Portal",
    connectWorker: "Connect Worker",
    activeWorkers: "Active Workers",
    assistedApplications: "Assisted Applications",
    consentNotice: "Worker has granted permission to Agent to assist with NearVia.",

    // Messaging & Notifications
    noConversations: "No conversations yet",
    typeMessage: "Type a message...",
    send: "Send",
    markAllAsRead: "Mark all as read",
    noNotifications: "No notifications",
    unread: "Unread",

    // Common Actions & Errors
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    back: "Back",
    close: "Close",
    loading: "Loading...",
    retry: "Try Again",
    error: "Error",
    success: "Success",
    somethingWentWrong: "Something went wrong. Please try again.",
    requiredField: "This field is required",

    // Language Names
    english: "English",
    kannada: "ಕನ್ನಡ",
    hindi: "हिंदी",
  },

  kn: {
    // Navigation & Brand
    brandTagline: "ನಿಮ್ಮ ಸಮೀಪದ ಕೆಲಸ",
    findWork: "ಕೆಲಸ ಹುಡುಕಿ (5 ಕಿ.ಮೀ)",
    myShifts: "ನನ್ನ ಪಾಳಿಗಳು",
    postWork: "ಕೆಲಸ ಪೋಸ್ಟ್ ಮಾಡಿ",
    myPostings: "ನನ್ನ ಪೋಸ್ಟಿಂಗ್‌ಗಳು",
    myApplications: "ನನ್ನ ಅರ್ಜಿಗಳು",
    dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    logIn: "ಲಾಗಿನ್",
    getStarted: "ಪ್ರಾರಂಭಿಸಿ",
    logOut: "ಲಾಗ್‌ಔಟ್",
    networkLive: "5 ಕಿ.ಮೀ ಲೈವ್ ನೆಟ್‌ವರ್ಕ್",
    profile: "ನನ್ನ ಪ್ರೊಫೈಲ್",
    messages: "ಸಂದೇಶಗಳು",
    notifications: "ಸೂಚನೆಗಳು",
    home: "ಮುಖಪುಟ",
    shifts: "ಪಾಳಿಗಳು",
    workers: "ಕೆಲಸಗಾರರು",
    myWork: "ನನ್ನ ಕೆಲಸ",
    findJobs: "ಕೆಲಸ ಹುಡುಕಿ",
    admin: "ನಿರ್ವಾಹಕ",
    earnings: "ಗಳಿಕೆ",
    wageSettlements: "ಸಂಬಳ ಇತ್ಯರ್ಥ",
    commandCenter: "ನಿಯಂತ್ರಣ ಕೊಠಡಿ",
    marketplace: "ಮಾರುಕಟ್ಟೆ",

    // Auth & Roles
    phoneLabel: "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ",
    passwordLabel: "ಪಾಸ್‌ವರ್ಡ್",
    fullNameLabel: "ಪೂರ್ಣ ಹೆಸರು",
    enterPhone: "10-ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ",
    enterPassword: "ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ",
    enterFullName: "ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ನಮೂದಿಸಿ",
    roleWorker: "ಕೆಲಸಗಾರ (ಕೆಲಸ ಹುಡುಕುತ್ತಿದ್ದೇನೆ)",
    roleProvider: "ಉದ್ಯೋಗದಾತ (ಆಳು ಬೇಕಾಗಿದೆ)",
    roleAgent: "ಏಜೆಂಟ್ (ಕೆಲಸಗಾರರಿಗೆ ನೆರವು)",
    workerDesc: "ದೈನಂದಿನ ಕೆಲಸ ಮತ್ತು ಪಾಳಿಗಳನ್ನು ಹುಡುಕಿ ಅದೇ ದಿನ ಸಂಬಳ ಪಡೆಯಿರಿ.",
    providerDesc: "ತಕ್ಷಣದ ಕೆಲಸಗಳಿಗೆ ಸ್ಥಳೀಯ ಪರಿಶೀಲಿಸಿದ ಕೆಲಸಗಾರರನ್ನು ನೇಮಿಸಿ.",
    agentDesc: "ಡಿಜಿಟಲ್ ಜ್ಞಾನವಿಲ್ಲದ ಕೆಲಸಗಾರರಿಗೆ ಕೆಲಸ ಹುಡುಕಲು ನೆರವಾಗಿ.",
    loginTitle: "ಮರಳಿ ಸುಸ್ವಾಗತ",
    loginSubtitle: "ನಿಮ್ಮ NearVia ಖಾತೆಗೆ ಲಾಗಿನ್ ಮಾಡಿ",
    registerTitle: "ಖಾತೆ ತೆರೆಯಿರಿ",
    registerSubtitle: "ನಿಮ್ಮ ಸ್ಥಳೀಯ 5 ಕಿ.ಮೀ ಜಾಲಕ್ಕೆ ಸೇರಿ",
    dontHaveAccount: "ಖಾತೆ ಇಲ್ಲವೇ?",
    alreadyHaveAccount: "ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?",
    createAccount: "ನೋಂದಾಯಿಸಿ",
    loginBtn: "ಲಾಗಿನ್ ಮಾಡಿ",
    invalidCredentials: "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ತಪ್ಪಾಗಿದೆ.",

    // Discovery & Job Cards
    workWithinReach: "ನಿಮ್ಮ ಸಮೀಪದ ಕೆಲಸ",
    discoverySubtitle: "ನಿಮ್ಮ ಸ್ಥಳದ ಸುತ್ತಮುತ್ತಲಿನ ಅದೇ ದಿನದ ಪಾವತಿಯೊಂದಿಗೆ ತಕ್ಷಣದ ಕೆಲಸಗಳು ಮತ್ತು ಪಾಳಿಗಳು.",
    searchPlaceholder: "ಕೆಲಸ ಅಥವಾ ಕೌಶಲ್ಯದ ಮೂಲಕ ಹುಡುಕಿ (ಉದಾ: ಬೇಕರಿ ಕೆಲಸ, ಸ್ವಚ್ಛತೆ, ಲೋಡಿಂಗ್)...",
    voiceSearchListening: "ಕೇಳಿಸಿಕೊಳ್ಳಲಾಗುತ್ತಿದೆ... ಮಾತನಾಡಿ",
    voiceSearchTooltip: "ಧ್ವನಿಯ ಮೂಲಕ ಹುಡುಕಲು ಒತ್ತಿ",
    listenToJob: "ಕೆಲಸದ ವಿವರಗಳನ್ನು ಆಲಿಸಿ",
    stopListening: "ಆಲಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿ",
    searchWork: "ಹುಡುಕಿ",
    allTypes: "ಎಲ್ಲಾ ವಿಧಗಳು",
    task: "ಸಣ್ಣ ಕೆಲಸ (1–3 ಗಂಟೆ)",
    shift: "ಪಾಳಿ (4–8 ಗಂಟೆ)",
    job: "ದೈನಂದಿನ ಕೆಲಸ (1+ ದಿನ)",
    recommended: "ಉತ್ತಮ ಹೊಂದಾಣಿಕೆ",
    nearest: "ಅತ್ಯಂತ ಹತ್ತಿರ",
    highestPay: "ಹೆಚ್ಚು ಸಂಬಳ",
    fixedPayout: "ನಿಶ್ಚಿತ ಪಾವತಿ",
    perHour: "/ ಗಂಟೆಗೆ",
    match: "ಹೊಂದಾಣಿಕೆ",
    distanceAway: "ದೂರದಲ್ಲಿದೆ",
    applyNow: "ಅರ್ಜಿ ಸಲ್ಲಿಸಿ",
    viewDetails: "ವಿವರ ನೋಡಿ",
    applied: "ಸಲ್ಲಿಸಲಾಗಿದೆ",
    noJobsFound: "ಆಯ್ಕೆಮಾಡಿದ ವ್ಯಾಪ್ತಿಯಲ್ಲಿ ಯಾವುದೇ ಕೆಲಸ ಕಂಡುಬಂದಿಲ್ಲ",
    expandRadius: "5 ಕಿ.ಮೀ ವಿಸ್ತರಿಸಿ",
    timing: "ಕೆಲಸದ ಸಮಯ",
    wage: "ಸಂಬಳ ಮತ್ತು ಪಾವತಿ",
    duration: "ಅವಧಿ",
    location: "ಕೆಲಸದ ಸ್ಥಳ",
    requirements: "ಅಗತ್ಯತೆಗಳು",
    urgent: "ತುರ್ತು",
    startingSoon: "ಶೀಘ್ರದಲ್ಲೇ ಪ್ರಾರಂಭ",
    hours: "ಗಂಟೆಗಳು",
    kmAway: "ಕಿ.ಮೀ ದೂರದಲ್ಲಿದೆ",
    distance: "ದೂರ",
    schedule: "ಸಮಯ",
    employer: "ಉದ್ಯೋಗದಾತ",
    locateOnMap: "ನಕ್ಷೆಯಲ್ಲಿ ನೋಡಿ",
    directions: "ದಾರಿ ತಿಳಿಯಿರಿ",
    filterAll: "ಎಲ್ಲವೂ",
    filterActive: "ಸಕ್ರಿಯ",
    filterCompleted: "ಪೂರ್ಣಗೊಂಡಿದೆ",

    // Applications & Hiring
    submitApplication: "ಕೆಲಸಕ್ಕೆ ಅರ್ಜಿ ಹಾಕಿ",
    proposedWage: "ಕೋರಿದ ಸಂಬಳ",
    applicationPending: "ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
    shortlisted: "ಆಯ್ಕೆ ಪಟ್ಟಿಯಲ್ಲಿದೆ",
    accepted: "ನೇಮಕಗೊಂಡಿದೆ 🎉",
    rejected: "ಆಯ್ಕೆಯಾಗಿಲ್ಲ",
    confirmAttendance: "ಹಾಜರಾತಿಯನ್ನು ದೃಢೀಕರಿಸಿ",
    hired: "ನೇಮಕಗೊಂಡಿದೆ 🎉",
    agentAssisted: "ಏಜೆಂಟ್ ನೆರವು",
    assistedByAgent: "ಸ್ಥಳೀಯ ಏಜೆಂಟ್ ಸಹಾಯದಿಂದ ಅರ್ಜಿ ಸಲ್ಲಿಸಲಾಗಿದೆ",
    statusPendingReview: "ಪರಿಶೀಲನೆ ಬಾಕಿ ಇದೆ",
    statusShortlisted: "ಆಯ್ಕೆ ಪಟ್ಟಿಯಲ್ಲಿದೆ ✨",
    statusDeclined: "ತಿರಸ್ಕರಿಸಲಾಗಿದೆ",
    statusWithdrawn: "ಹಿಂಪಡೆಯಲಾಗಿದೆ",
    withdrawApplication: "ಅರ್ಜಿ ಹಿಂಪಡೆಯಿರಿ",
    withdrawPrompt: "ನೀವು ನಿಜವಾಗಿಯೂ ಈ ಅರ್ಜಿಯನ್ನು ಹಿಂಪಡೆಯಲು ಬಯಸುವಿರಾ?",
    withdrawSuccess: "ಅರ್ಜಿಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಹಿಂಪಡೆಯಲಾಗಿದೆ.",
    applicationsTitle: "ನಿಮ್ಮ ಕೆಲಸದ ಅರ್ಜಿಗಳು",
    applicationsSubtitle: "ಸ್ಥಿತಿ, ಆಯ್ಕೆ ಮತ್ತು ಉದ್ಯೋಗದಾತರ ನಿರ್ಧಾರಗಳನ್ನು ನೇರವಾಗಿ ಪರಿಶೀಲಿಸಿ.",
    exploreWork: "5 ಕಿ.ಮೀ ಕೆಲಸ ಹುಡುಕಿ",

    // Assignments & Shift Execution
    myActiveShifts: "ನನ್ನ ಸಕ್ರಿಯ ಪಾಳಿಗಳು",
    checkIn: "ಹಾಜರಾತಿ (ಚೆಕ್-ಇನ್)",
    checkOut: "ಕೆಲಸ ಮುಕ್ತಾಯ (ಚೆಕ್-ಔಟ್)",
    arrivedAtLocation: "ನಾನು ಸ್ಥಳಕ್ಕೆ ತಲುಪಿದ್ದೇನೆ",
    verifyingGps: "ಸ್ಥಳ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...",
    gpsVerified: "ಸ್ಥಳ ದೃಢಪಟ್ಟಿದೆ",
    gpsFailed: "ಕೆಲಸದ ಸ್ಥಳದಿಂದ 500 ಮೀಟರ್ ಒಳಗೆ ಇರಿ",
    enterPin: "4-ಅಂಕಿಯ ಕೆಲಸದ ಪಿನ್ ಹಾಕಿ",
    jobPin: "ಕೆಲಸದ ಪಿನ್ (PIN)",
    shiftCompleted: "ಕೆಲಸ ಪೂರ್ಣಗೊಂಡಿದೆ",
    statusAssigned: "ನೇಮಿಸಲಾಗಿದೆ",
    statusConfirmed: "ದೃಢಪಟ್ಟಿದೆ",
    statusCheckedIn: "ಹಾಜರಾಗಿದ್ದಾರೆ",
    statusInProgress: "ಪ್ರಗತಿಯಲ್ಲಿದೆ",
    statusCompleted: "ಪೂರ್ಣಗೊಂಡಿದೆ",
    statusClosed: "ಇತ್ಯರ್ಥಗೊಂಡಿದೆ",
    shiftDispatch: "ಪಾಳಿ ನಿರ್ವಹಣೆ ಮತ್ತು ಹಾಜರಾತಿ",
    hiredTapToConfirm: "🎉 ನೇಮಕಗೊಂಡಿದೆ • ದೃಢೀಕರಿಸಿ",
    confirmedReadyForArrival: "ದೃಢಪಟ್ಟಿದೆ • ಹಾಜರಾತಿಗೆ ಸಿದ್ಧ",
    shiftInProgress: "ಕೆಲಸ ನಡೆಯುತ್ತಿದೆ",
    shiftCompletedBadge: "ಕೆಲಸ ಪೂರ್ಣಗೊಂಡಿದೆ",
    confirmAttendancePrompt: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹಾಜರಾತಿಯನ್ನು ದೃಢೀಕರಿಸಿ",
    enterPinToVerify: "ದೃಢೀಕರಣಕ್ಕಾಗಿ 4-ಅಂಕಿಯ ಪಿನ್ ಹಾಕಿ",

    // Payments & Settlement
    settlementPending: "ಪಾವತಿ ಬಾಕಿ ಇದೆ",
    cashPayment: "ನಗದು ಪಾವತಿ",
    onlinePayment: "ಆನ್‌ಲೈನ್ ಪಾವತಿ (UPI)",
    payWorker: "ಸಂಬಳ ನೀಡಿ",
    paymentPin: "ಪಾವತಿ ಪಿನ್",
    paymentReceipt: "ಪಾವತಿ ರಶೀದಿ",
    paid: "ಪಾವತಿಸಲಾಗಿದೆ",
    amountPaid: "ಪಾವತಿಸಿದ ಮೊತ್ತ",
    wageBreakdown: "ಸಂಬಳದ ವಿವರ",
    downloadReceipt: "ರಶೀದಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ",
    cashHandoverNotice: "ಕೆಲಸ ಮುಗಿದ ನಂತರ ನಗದು ಹಸ್ತಾಂತರಿಸಿ ಮತ್ತು ಪಿನ್ ಪಡೆಯಿರಿ.",
    settlementPin: "ಇತ್ಯರ್ಥ ಪಿನ್ (PIN)",
    enterPinToConfirm: "ದೃಢೀಕರಿಸಲು ಪಿನ್ ನಮೂದಿಸಿ",
    generatePin: "ಪಿನ್ ರಚಿಸಿ",
    copyPin: "ಪಿನ್ ನಕಲಿಸಿ",
    pinCopied: "ಪಿನ್ ನಕಲಿಸಲಾಗಿದೆ!",
    confirmCashReceipt: "ನಗದು ಸ್ವೀಕರಿಸಿದ್ದನ್ನು ದೃಢೀಕರಿಸಿ",
    handoverCashPrompt: "ಕೆಲಸಗಾರರಿಗೆ ಸರಿಯಾದ ಮೊತ್ತವನ್ನು ನಗದಾಗಿ ನೀಡಿ.",
    paymentCompleted: "ಪಾವತಿ ಪೂರ್ಣಗೊಂಡಿದೆ",
    earningsToday: "ಇಂದಿನ ಗಳಿಕೆ",
    earningsMonth: "ಈ ತಿಂಗಳ ಗಳಿಕೆ",
    totalEarnings: "ಒಟ್ಟು ಗಳಿಕೆ",

    // Worker Actions & Status
    availableNow: "ಈಗ ಲಭ್ಯವಿದೆ",
    goOffline: "ಆಫ್‌ಲೈನ್ ಮಾಡಿ",
    inProgress: "ಪ್ರಗತಿಯಲ್ಲಿದೆ",
    pending: "ಬಾಕಿ ಇದೆ",

    // Safety & Assistance
    safetyCenter: "ಸುರಕ್ಷತಾ ಕೇಂದ್ರ",
    reportIssue: "ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ",
    emergencyNotice: "ತುರ್ತು ಸಂದರ್ಭದಲ್ಲಿ 112 ಕರೆ ಮಾಡಿ.",
    fileDispute: "ತಕರಾರು ದಾಖಲಿಸಿ",
    disputePending: "ತಕರಾರು ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
    disputeResolved: "ತಕರಾರು ಇತ್ಯರ್ಥವಾಗಿದೆ",
    nationalEmergency112: "ರಾಷ್ಟ್ರೀಯ ತುರ್ತು: 112",
    womenHelpline1091: "ಮಹಿಳಾ ಸಹಾಯವಾಣಿ: 1091",
    policeAmbulance: "ಪೊಲೀಸ್: 100 / ಆಂಬ್ಯುಲೆನ್ಸ್: 108",
    safetyHelplineTitle: "NEARVIA 24/7 ಸುರಕ್ಷತಾ ಮಾರ್ಗದರ್ಶನ",
    safetyHelplineDesc: "ವಂಚನೆ, ಕಿರುಕುಳ ಅಥವಾ ಸುರಕ್ಷತಾ ಸಮಸ್ಯೆಗಳಿಗೆ ತಕ್ಷಣ ತುರ್ತು ಸೇವೆಗಳನ್ನು ಸಂಪರ್ಕಿಸಿ.",

    // Agent Marketplace
    agentPortal: "ಏಜೆಂಟ್ ಪೋರ್ಟಲ್",
    connectWorker: "ಕೆಲಸಗಾರರನ್ನು ಸೇರಿಸಿ",
    activeWorkers: "ಸಕ್ರಿಯ ಕೆಲಸಗಾರರು",
    assistedApplications: "ನೆರವಿನ ಅರ್ಜಿಗಳು",
    consentNotice: "ಕೆಲಸಗಾರರು ಏಜೆಂಟ್ ಸಹಾಯಕ್ಕೆ ಒಪ್ಪಿಗೆ ನೀಡಿದ್ದಾರೆ.",

    // Messaging & Notifications
    noConversations: "ಯಾವುದೇ ಸಂಭಾಷಣೆಗಳಿಲ್ಲ",
    typeMessage: "ಸಂದೇಶ ಬರೆಯಿರಿ...",
    send: "ಕಳುಹಿಸಿ",
    markAllAsRead: "ಎಲ್ಲವನ್ನೂ ಓದಿದಂತೆ ಗುರುತಿಸಿ",
    noNotifications: "ಯಾವುದೇ ಸೂಚನೆಗಳಿಲ್ಲ",
    unread: "ಓದದಿರುವುದು",

    // Common Actions & Errors
    save: "ಉಳಿಸಿ",
    cancel: "ರದ್ದುಮಾಡಿ",
    confirm: "ದೃಢೀಕರಿಸಿ",
    back: "ಹಿಂದಕ್ಕೆ",
    close: "ಮುಚ್ಚಿ",
    loading: "ತೆರೆಯಲಾಗುತ್ತಿದೆ...",
    retry: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
    error: "ದೋಷ",
    success: "ಯಶಸ್ವಿ",
    somethingWentWrong: "ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಪುನಃ ಪ್ರಯತ್ನಿಸಿ.",
    requiredField: "ಈ ಮಾಹಿತಿ ಅಗತ್ಯವಿದೆ",

    // Language Names
    english: "English",
    kannada: "ಕನ್ನಡ",
    hindi: "हिंदी",
  },

  hi: {
    // Navigation & Brand
    brandTagline: "काम आपके पास",
    findWork: "काम ढूंढें (5 KM)",
    myShifts: "मेरी शिफ्ट",
    postWork: "काम पोस्ट करें",
    myPostings: "मेरी पोस्टिंग्स",
    myApplications: "मेरे आवेदन",
    dashboard: "डैशबोर्ड",
    logIn: "लॉग इन",
    getStarted: "शुरू करें",
    logOut: "लॉग आउट",
    networkLive: "5 KM लाइव नेटवर्क",
    profile: "मेरी प्रोफ़ाइल",
    messages: "संदेश",
    notifications: "सूचनाएं",
    home: "होम",
    shifts: "शिफ्ट्स",
    workers: "कामगार",
    myWork: "मेरा काम",
    findJobs: "काम खोजें",
    admin: "एडमिन",
    earnings: "कमाई",
    wageSettlements: "मजदूरी निपटान",
    commandCenter: "कमांड सेंटर",
    marketplace: "मार्केटप्लेस",

    // Auth & Roles
    phoneLabel: "मोबाइल नंबर",
    passwordLabel: "पासवर्ड",
    fullNameLabel: "पूरा नाम",
    enterPhone: "10 अंकों का मोबाइल नंबर डालें",
    enterPassword: "अपना पासवर्ड डालें",
    enterFullName: "अपना पूरा नाम डालें",
    roleWorker: "कामगार (काम ढूंढ रहे हैं)",
    roleProvider: "मालिक / ठेकेदार (मजदूर चाहिए)",
    roleAgent: "एजेंट (कामगारों के सहायक)",
    workerDesc: "अपने पास तुरंत काम खोजें और उसी दिन नकद/UPI भुगतान पाएं।",
    providerDesc: "तुरंत काम के लिए सत्यापित स्थानीय कामगारों को बुलाएं।",
    agentDesc: "कम डिजिटल जानकारी वाले कामगारों को काम दिलाने में मदद करें।",
    loginTitle: "फिर से स्वागत है",
    loginSubtitle: "अपने NearVia खाते में लॉगिन करें",
    registerTitle: "नया खाता बनाएं",
    registerSubtitle: "अपने स्थानीय 5 KM नेटवर्क से जुड़ें",
    dontHaveAccount: "खाता नहीं है?",
    alreadyHaveAccount: "पहले से खाता है?",
    createAccount: "साइन अप करें",
    loginBtn: "लॉगिन करें",
    invalidCredentials: "मोबाइल नंबर या पासवर्ड गलत है।",

    // Discovery & Job Cards
    workWithinReach: "काम आपके पास",
    discoverySubtitle: "आपके आस-पास उसी दिन भुगतान के साथ तुरंत काम और शिफ्ट्स।",
    searchPlaceholder: "काम या हुनर से खोजें (जैसे बेकरी हेल्पर, सफाई, लोडिंग)...",
    voiceSearchListening: "सुन रहे हैं... अब बोलिए",
    voiceSearchTooltip: "आवाज़ से खोजने के लिए दबाएं",
    listenToJob: "काम का विवरण सुनें",
    stopListening: "सुनना बंद करें",
    searchWork: "खोजें",
    allTypes: "सभी प्रकार",
    task: "छोटा काम (1–3 घंटे)",
    shift: "शिफ्ट (4–8 घंटे)",
    job: "दैनिक काम (1+ दिन)",
    recommended: "उत्तम मैच",
    nearest: "सबसे नजदीक",
    highestPay: "ज्यादा कमाई",
    fixedPayout: "तय भुगतान",
    perHour: "/ घंटा",
    match: "मैच",
    distanceAway: "दूरी पर",
    applyNow: "आवेदन करें",
    viewDetails: "विवरण देखें",
    applied: "आवेदन किया गया",
    noJobsFound: "चुने गए दायरे में कोई काम नहीं मिला",
    expandRadius: "5 KM तक बढ़ाएं",
    timing: "काम का समय",
    wage: "मजदूरी और भुगतान",
    duration: "अवधि",
    location: "काम की जगह",
    requirements: "ज़रूरतें",
    urgent: "जरूरी",
    startingSoon: "जल्द शुरू",
    hours: "घंटे",
    kmAway: "कि.मी दूरी पर",
    distance: "दूरी",
    schedule: "समय",
    employer: "मालिक / ठेकेदार",
    locateOnMap: "नक्शे पर देखें",
    directions: "रास्ता देखें",
    filterAll: "सभी",
    filterActive: "सक्रिय",
    filterCompleted: "पूर्ण",

    // Applications & Hiring
    submitApplication: "काम के लिए आवेदन करें",
    proposedWage: "मांगी गई मजदूरी",
    applicationPending: "जांच जारी है",
    shortlisted: "शॉर्टलिस्टेड",
    accepted: "नियुक्त 🎉",
    rejected: "चयन नहीं हुआ",
    confirmAttendance: "उपस्थिति की पुष्टि करें",
    hired: "नियुक्त 🎉",
    agentAssisted: "एजेंट सहायता",
    assistedByAgent: "स्थानीय एजेंट की सहायता से आवेदन किया गया",
    statusPendingReview: "जांच जारी है",
    statusShortlisted: "शॉर्टलिस्टेड ✨",
    statusDeclined: "अस्वीकृत",
    statusWithdrawn: "वापस लिया गया",
    withdrawApplication: "आवेदन वापस लें",
    withdrawPrompt: "क्या आप वाकई यह आवेदन वापस लेना चाहते हैं?",
    withdrawSuccess: "आवेदन सफलतापूर्वक वापस लिया गया।",
    applicationsTitle: "आपके काम के आवेदन",
    applicationsSubtitle: "स्थिति, चयन और काम से जुड़ी हर सूचना सीधे देखें।",
    exploreWork: "5 KM काम खोजें",

    // Assignments & Shift Execution
    myActiveShifts: "मेरी सक्रिय शिफ्ट्स",
    checkIn: "उपस्थिति (चेक-इन)",
    checkOut: "काम समाप्ति (चेक-आउट)",
    arrivedAtLocation: "मैं काम की जगह पहुंच गया हूं",
    verifyingGps: "लोकेशन जांची जा रही है...",
    gpsVerified: "लोकेशन सत्यापित",
    gpsFailed: "कृपया काम की जगह से 500 मीटर के भीतर रहें",
    enterPin: "4 अंकों का जॉब पिन डालें",
    jobPin: "जॉब पिन (PIN)",
    shiftCompleted: "काम पूर्ण",
    statusAssigned: "नियुक्त",
    statusConfirmed: "पुष्टि की गई",
    statusCheckedIn: "उपस्थित",
    statusInProgress: "जारी है",
    statusCompleted: "पूर्ण",
    statusClosed: "निपटारा पूर्ण",
    shiftDispatch: "शिफ्ट संचालन व उपस्थिति",
    hiredTapToConfirm: "🎉 नियुक्त • पुष्टि करने के लिए दबाएं",
    confirmedReadyForArrival: "पुष्टि की गई • पहुंचने के लिए तैयार",
    shiftInProgress: "काम जारी है",
    shiftCompletedBadge: "काम पूर्ण",
    confirmAttendancePrompt: "कृपया अपनी उपस्थिति की पुष्टि करें",
    enterPinToVerify: "सत्यापन के लिए 4 अंकों का पिन डालें",

    // Payments & Settlement
    settlementPending: "भुगतान बाकी है",
    cashPayment: "नकद भुगतान",
    onlinePayment: "ऑनलाइन भुगतान (UPI)",
    payWorker: "मजदूरी दें",
    paymentPin: "भुगतान पिन",
    paymentReceipt: "भुगतान रसीद",
    paid: "भुगतान हो गया",
    amountPaid: "भुगतान की गई राशि",
    wageBreakdown: "मजदूरी का विवरण",
    downloadReceipt: "रसीद डाउनलोड करें",
    cashHandoverNotice: "काम समाप्त होने पर नकद भुगतान करें और पिन प्राप्त करें।",
    settlementPin: "निपटान पिन (PIN)",
    enterPinToConfirm: "पुष्टि के लिए पिन डालें",
    generatePin: "पिन बनाएं",
    copyPin: "पिन कॉपी करें",
    pinCopied: "पिन कॉपी हो गया!",
    confirmCashReceipt: "नकद प्राप्ति की पुष्टि करें",
    handoverCashPrompt: "कामगार को सही राशि नकद में दें।",
    paymentCompleted: "भुगतान पूर्ण",
    earningsToday: "आज की कमाई",
    earningsMonth: "इस महीने की कमाई",
    totalEarnings: "कुल कमाई",

    // Worker Actions & Status
    availableNow: "अभी उपलब्ध",
    goOffline: "ऑफलाइन जाएं",
    inProgress: "जारी है",
    pending: "लंबित",

    // Safety & Assistance
    safetyCenter: "सुरक्षा केंद्र",
    reportIssue: "समस्या दर्ज करें",
    emergencyNotice: "आपातकालीन स्थिति में तुरंत 112 पर कॉल करें।",
    fileDispute: "विवाद दर्ज करें",
    disputePending: "विवाद जांच में है",
    disputeResolved: "विवाद सुलझ गया",
    nationalEmergency112: "राष्ट्रीय आपातकाल: 112",
    womenHelpline1091: "महिला हेल्पलाइन: 1091",
    policeAmbulance: "पुलिस: 100 / एम्बुलेंस: 108",
    safetyHelplineTitle: "NEARVIA 24/7 सुरक्षा व आपातकालीन सहायता",
    safetyHelplineDesc: "धोखाधड़ी, उत्पीड़न या सुरक्षा समस्याओं के लिए तुरंत आपातकालीन सेवाओं से संपर्क करें।",

    // Agent Marketplace
    agentPortal: "एजेंट पोर्टल",
    connectWorker: "कामगार को जोड़ें",
    activeWorkers: "सक्रिय कामगार",
    assistedApplications: "सहायता प्राप्त आवेदन",
    consentNotice: "कामगार ने एजेंट को सहायता की अनुमति दी है।",

    // Messaging & Notifications
    noConversations: "कोई बातचीत नहीं है",
    typeMessage: "संदेश लिखें...",
    send: "भेजें",
    markAllAsRead: "सभी पढ़े गए चिह्नित करें",
    noNotifications: "कोई सूचना नहीं है",
    unread: "अपठित",

    // Common Actions & Errors
    save: "सहेजें",
    cancel: "रद्द करें",
    confirm: "पुष्टि करें",
    back: "पीछे",
    close: "बंद करें",
    loading: "लोड हो रहा है...",
    retry: "पुनः प्रयास करें",
    error: "त्रुटि",
    success: "सफल",
    somethingWentWrong: "कुछ गड़बड़ हुई। कृपया पुनः प्रयास करें।",
    requiredField: "यह जानकारी आवश्यक है",

    // Language Names
    english: "English",
    kannada: "ಕನ್ನಡ",
    hindi: "हिंदी",
  },
};

/**
 * Currency Formatter (Indian Rupee with en-IN comma grouping)
 */
export const formatCurrency = (amount: number | string): string => {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString("en-IN")}`;
};

/**
 * Distance Formatter with localized units (km, ಕಿ.ಮೀ, कि.मी)
 */
export const formatDistance = (km: number | string, language: Language = "en"): string => {
  const val = Number(km) || 0;
  if (language === "kn") {
    return val < 1 ? `${Math.round(val * 1000)} ಮೀ` : `${val.toFixed(1)} ಕಿ.ಮೀ`;
  }
  if (language === "hi") {
    return val < 1 ? `${Math.round(val * 1000)} मी` : `${val.toFixed(1)} कि.मी`;
  }
  return val < 1 ? `${Math.round(val * 1000)} m` : `${val.toFixed(1)} km`;
};

/**
 * Date Formatter localized to language locale
 */
export const formatDate = (date: string | Date, language: Language = "en"): string => {
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    const locale = language === "kn" ? "kn-IN" : language === "hi" ? "hi-IN" : "en-IN";
    return d.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(date);
  }
};

/**
 * Map Language to BCP 47 SpeechSynthesis language code
 */
export const getSpeechLanguageCode = (language: Language): string => {
  switch (language) {
    case "kn":
      return "kn-IN";
    case "hi":
      return "hi-IN";
    default:
      return "en-IN";
  }
};

/**
 * Natural language job narration builder across English, Kannada, and Hindi
 */
export const buildJobNarrationText = (
  job: {
    title: string;
    description?: string;
    paymentAmount?: number | string;
    durationHours?: number;
    distanceKm?: number;
    requirements?: string;
  },
  language: Language = "en"
): string => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const pay = formatCurrency(job.paymentAmount || 0);
  const dist = job.distanceKm !== undefined ? formatDistance(job.distanceKm, language) : "";
  const hours = job.durationHours || 4;

  if (language === "kn") {
    let str = `${job.title}. ${t.wage} ${pay}. ${t.duration} ${hours} ಗಂಟೆಗಳು. `;
    if (dist) str += `ಸ್ಥಳ ${dist} ${t.distanceAway}. `;
    if (job.description) str += `ವಿವರ: ${job.description}. `;
    if (job.requirements) str += `ಅಗತ್ಯತೆಗಳು: ${job.requirements}.`;
    return str.trim();
  }

  if (language === "hi") {
    let str = `${job.title}. ${t.wage} ${pay}. ${t.duration} ${hours} घंटे. `;
    if (dist) str += `दूरी ${dist} ${t.distanceAway}. `;
    if (job.description) str += `विवरण: ${job.description}. `;
    if (job.requirements) str += `ज़रूरतें: ${job.requirements}.`;
    return str.trim();
  }

  // English default
  let str = `${job.title}. ${t.wage} is ${pay}. ${t.duration} is ${hours} hours. `;
  if (dist) str += `Located ${dist} ${t.distanceAway}. `;
  if (job.description) str += `Details: ${job.description}. `;
  if (job.requirements) str += `Requirements: ${job.requirements}.`;
  return str.trim();
};

/**
 * Localized Dynamic Status Badges for Assignments
 */
export const getLocalizedAssignmentStatus = (
  status: string,
  language: Language = "en"
): string => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  switch (status) {
    case "ASSIGNED":
      return t.hiredTapToConfirm;
    case "CONFIRMED":
      return t.confirmedReadyForArrival;
    case "IN_PROGRESS":
      return t.shiftInProgress;
    case "COMPLETED":
      return t.shiftCompletedBadge;
    case "CLOSED":
      return t.statusClosed;
    default:
      return status;
  }
};

/**
 * Localized Dynamic Status Badges for Applications
 */
export const getLocalizedApplicationStatus = (
  status: string,
  language: Language = "en"
): string => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  switch (status) {
    case "PENDING":
      return t.statusPendingReview;
    case "SHORTLISTED":
      return t.statusShortlisted;
    case "ACCEPTED":
      return t.accepted;
    case "REJECTED":
      return t.statusDeclined;
    case "WITHDRAWN":
      return t.statusWithdrawn;
    default:
      return status;
  }
};
