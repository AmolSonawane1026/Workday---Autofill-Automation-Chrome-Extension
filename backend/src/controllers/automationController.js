/**
 * Automation Controller
 * Provides diagnostic, benchmark, and Workday mock fixtures for testing
 */

export async function getTargetWorkdayFixtures(req, res) {
  const company = req.query.company || 'nvidia';

  const mockNvidiaApplicationSteps = [
    {
      stepNumber: 1,
      stepName: 'My Information',
      path: '/apply/my-information',
      fields: [
        { id: 'f1', label: 'First Name', name: 'firstName', type: 'text', required: true, automationId: 'legalNameSection_firstName' },
        { id: 'f2', label: 'Last Name', name: 'lastName', type: 'text', required: true, automationId: 'legalNameSection_lastName' },
        { id: 'f2b', label: 'Suffix', name: 'suffix', type: 'select', required: false, automationId: 'legalNameSection_social' },
        { id: 'f3', label: 'Email Address', name: 'email', type: 'email', required: true, automationId: 'email' },
        { id: 'f4', label: 'Phone Device Type', name: 'phoneType', type: 'select', required: true, options: ['Mobile', 'Home', 'Work'], automationId: 'phone-device-type' },
        { id: 'f5', label: 'Phone Number', name: 'phoneNumber', type: 'tel', required: true, automationId: 'phoneNumber' },
        { id: 'f6', label: 'Address Line 1', name: 'addressLine1', type: 'text', required: true, automationId: 'addressSection_addressLine1' },
        { id: 'f7', label: 'City', name: 'city', type: 'text', required: true, automationId: 'addressSection_city' },
        { id: 'f8', label: 'State / Province', name: 'state', type: 'select', required: true, automationId: 'addressSection_countryRegion' },
        { id: 'f9', label: 'Postal Code', name: 'postalCode', type: 'text', required: true, automationId: 'addressSection_postalCode' },
        { id: 'f10', label: 'How Did You Hear About Us?', name: 'source', type: 'select', required: true, options: ['LinkedIn', 'Company Website', 'Referral', 'Naukri'], automationId: 'source' },
        { id: 'f11', label: 'Have you previously worked for this company?', name: 'previousWorker', type: 'radio', options: ['Yes', 'No'], required: false, automationId: 'previousWorker' }
      ]
    },
    {
      stepNumber: 2,
      stepName: 'My Experience',
      path: '/apply/experience',
      repeatableSections: ['workExperience', 'education'],
      fields: [
        { id: 'exp_1_title', label: 'Job Title', type: 'text', required: true, automationId: 'jobTitle' },
        { id: 'exp_1_company', label: 'Company', type: 'text', required: true, automationId: 'company' },
        { id: 'exp_1_location', label: 'Location', type: 'text', required: false, automationId: 'location' },
        { id: 'exp_1_start_month', label: 'Start Month', type: 'text', required: true, automationId: 'dateSectionMonth-input' },
        { id: 'exp_1_start_year', label: 'Start Year', type: 'text', required: true, automationId: 'dateSectionYear-input' },
        { id: 'exp_1_end_month', label: 'End Month', type: 'text', required: false, automationId: 'dateSectionMonth-input' },
        { id: 'exp_1_end_year', label: 'End Year', type: 'text', required: false, automationId: 'dateSectionYear-input' },
        { id: 'exp_1_role_desc', label: 'Role Description', type: 'textarea', required: false, automationId: 'description' },
        { id: 'edu_1_school', label: 'School or University', type: 'text', required: true, automationId: 'school' },
        { id: 'edu_1_degree', label: 'Degree', type: 'select', required: true, automationId: 'degree' },
        { id: 'edu_1_fos', label: 'Field of Study', type: 'text', required: true, automationId: 'fieldOfStudy' },
        { id: 'edu_1_gpa', label: 'GPA', type: 'text', required: false, automationId: 'gpa' },
        { id: 'edu_1_start_yr', label: 'First Year Attended', type: 'text', required: false, automationId: 'firstYearAttended' },
        { id: 'edu_1_end_yr', label: 'Last Year Attended', type: 'text', required: false, automationId: 'lastYearAttended' },
        { id: 'web_linkedin', label: 'LinkedIn URL', type: 'text', required: false, automationId: 'linkedinQuestion' },
        { id: 'web_1', label: 'Website URL', type: 'text', required: false, automationId: 'websitePanelSet-1' }
      ]
    },
    {
      stepNumber: 3,
      stepName: 'Application Questions',
      path: '/apply/questions',
      fields: [
        { id: 'q1', label: 'Are you legally authorized to work in the country of this role?', type: 'radio', options: ['Yes', 'No'], required: true, automationId: 'workAuthQuestion' },
        { id: 'q2', label: 'Will you now or in the future require visa sponsorship for employment?', type: 'radio', options: ['Yes', 'No'], required: true, automationId: 'sponsorshipQuestion' },
        { id: 'q3', label: 'Have you ever been employed by NVIDIA or an affiliate in the past?', type: 'radio', options: ['Yes', 'No'], required: true, automationId: 'priorEmploymentQuestion' }
      ]
    },
    {
      stepNumber: 4,
      stepName: 'Voluntary Disclosures',
      path: '/apply/voluntary-disclosures',
      fields: [
        { id: 'v1', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Non-Binary', 'I choose not to self-identify'], required: false, automationId: 'gender' },
        { id: 'v1b', label: 'Are you Hispanic or Latino?', type: 'select', options: ['Yes', 'No'], required: false, automationId: 'hispanicOrLatino' },
        { id: 'v2', label: 'Race / Ethnicity', type: 'select', options: ['Asian', 'Black or African American', 'Hispanic or Latino', 'White', 'Two or More Races', 'I choose not to self-identify'], required: false, automationId: 'ethnicityDropdown' },
        { id: 'v3', label: 'Veteran Status', type: 'select', options: ['I am not a protected veteran', 'I identify as a protected veteran', 'I choose not to self-identify'], required: false, automationId: 'veteranStatus' },
        { id: 'v4', label: 'I agree to the voluntary disclosure terms', type: 'checkbox', required: false, automationId: 'agreementCheckbox' }
      ]
    },
    {
      stepNumber: 5,
      stepName: 'Self-Identification',
      path: '/apply/self-identification',
      fields: [
        { id: 'si1', label: 'Full Name', type: 'text', required: true, automationId: 'name' },
        { id: 'si2', label: 'Date', type: 'date', required: true, automationId: 'dateIcon' },
        { id: 'si3', label: 'Disability Status', type: 'radio', options: ['Yes, I have a disability', 'No, I do not have a disability', 'I do not wish to answer'], required: false, automationId: 'disability' }
      ]
    },
    {
      stepNumber: 6,
      stepName: 'Review and Submit',
      path: '/apply/review',
      fields: [
        { id: 'ack', label: 'I acknowledge that the information provided is accurate and true.', type: 'checkbox', required: true, automationId: 'ack_terms' }
      ]
    }
  ];

  return res.status(200).json({
    success: true,
    company: company,
    targetUrl: 'https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/US-CA-Santa-Clara/Senior-DevOps-Engineer--Platform-Engineering_JR1968596',
    steps: mockNvidiaApplicationSteps,
    puppeteerAvailable: true
  });
}
