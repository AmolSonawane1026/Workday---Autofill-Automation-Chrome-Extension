import { describe, it, expect } from 'vitest';
import { mapFieldsHeuristically } from '../src/core/ai/field-mapper.js';

describe('Workday Field Mapping Engine', () => {
  const sampleProfile = {
    personalInfo: {
      firstName: 'Alex',
      lastName: 'Rivers',
      fullName: 'Alex Rivers',
      email: 'alex.rivers@example.com',
      phone: '+1 (408) 555-0142',
      address: {
        street: '2701 San Tomas Expressway',
        city: 'Santa Clara',
        state: 'CA',
        postalCode: '95050',
        country: 'United States of America'
      },
      linkedIn: 'https://linkedin.com/in/alexrivers',
      github: 'https://github.com/alexrivers',
      portfolio: 'https://alexrivers.dev'
    },
    workExperience: [
      {
        company: 'NVIDIA',
        jobTitle: 'Senior Platform Engineer',
        startDate: '2022-01',
        endDate: 'Present',
        isCurrent: true
      }
    ],
    education: [
      {
        institution: 'Stanford University',
        degree: 'Master of Science',
        fieldOfStudy: 'Computer Science'
      }
    ],
    skills: {
      technical: ['Python', 'Docker', 'Kubernetes', 'AWS', 'React.js']
    },
    workAuthorization: {
      authorizedInTargetCountry: true,
      requiresSponsorship: false
    }
  };

  it('accurately maps NVIDIA Workday personal information fields', () => {
    const workdayFields = [
      { id: 'f1', label: 'First Name', automationId: 'legalNameSection_firstName', type: 'text' },
      { id: 'f2', label: 'Last Name', automationId: 'legalNameSection_lastName', type: 'text' },
      { id: 'f3', label: 'Email', automationId: 'email', type: 'email' },
      { id: 'f4', label: 'Phone Number', automationId: 'phoneNumber', type: 'tel' },
      { id: 'f5', label: 'Address Line 1', automationId: 'addressSection_addressLine1', type: 'text' },
      { id: 'f6', label: 'City', automationId: 'addressSection_city', type: 'text' },
      { id: 'f7', label: 'State', automationId: 'addressSection_countryRegion', type: 'select' },
      { id: 'f8', label: 'Postal Code', automationId: 'addressSection_postalCode', type: 'text' },
      { id: 'f9', label: 'LinkedIn Profile', automationId: 'linkedin', type: 'text' },
      { id: 'f10', label: 'GitHub Profile', automationId: 'github', type: 'text' }
    ];

    const results = mapFieldsHeuristically(workdayFields, sampleProfile);

    expect(results.length).toBe(10);
    expect(results.find(r => r.id === 'f1').value).toBe('Alex');
    expect(results.find(r => r.id === 'f2').value).toBe('Rivers');
    expect(results.find(r => r.id === 'f3').value).toBe('alex.rivers@example.com');
    expect(results.find(r => r.id === 'f4').value).toBe('4085550142');
    expect(results.find(r => r.id === 'f5').value).toBe('2701 San Tomas Expressway');
    expect(results.find(r => r.id === 'f6').value).toBe('Santa Clara');
    expect(results.find(r => r.id === 'f7').value).toBe('CA');
    expect(results.find(r => r.id === 'f8').value).toBe('95050');
    expect(results.find(r => r.id === 'f9').value).toBe('https://linkedin.com/in/alexrivers');
    expect(results.find(r => r.id === 'f10').value).toBe('https://github.com/alexrivers');
  });

  it('correctly matches screening and work authorization questions', () => {
    const screeningFields = [
      { id: 'q1', label: 'Are you legally authorized to work in the country of this job?', automationId: 'workAuthQuestion', type: 'radio' },
      { id: 'q2', label: 'Will you now or in the future require visa sponsorship?', automationId: 'sponsorshipQuestion', type: 'radio' }
    ];

    const results = mapFieldsHeuristically(screeningFields, sampleProfile);
    expect(results.find(r => r.id === 'q1').value).toBe('Yes');
    expect(results.find(r => r.id === 'q2').value).toBe('No');
  });

  it('accurately maps Step 2 Work Experience, Education, and Skills fields', () => {
    const candidateProfile = {
      personalInfo: {
        firstName: 'Amol',
        lastName: 'Sonawane',
        email: 'amol@example.com'
      },
      workExperience: [
        {
          company: 'SevenMentor Corporate Services Pvt. Ltd.',
          jobTitle: 'Full Stack Developer',
          startDate: 'Nov 2024',
          endDate: 'Present',
          isCurrent: true,
          description: 'Developed responsive web applications using React and Node.js.',
          highlights: ['Built REST APIs', 'Optimized database queries']
        }
      ],
      education: [
        {
          degree: 'Bachelor in Computer Applications (BCA)  Brijlal Biyani Science Co',
          institution: '',
          fieldOfStudy: ''
        }
      ],
      skills: {
        technical: ['React.js', 'Node.js', 'JavaScript', 'MongoDB', 'Python']
      }
    };

    const step2Fields = [
      { id: 'f1', label: 'Job Title', automationId: 'jobTitle', type: 'text' },
      { id: 'f2', label: 'Company', automationId: 'company', type: 'text' },
      { id: 'f3', label: 'Month', automationId: 'dateSectionMonth-input', type: 'text' },
      { id: 'f4', label: 'Year', automationId: 'dateSectionYear-input', type: 'text' },
      { id: 'f5', label: 'Role Description', automationId: 'description', type: 'textarea' },
      { id: 'f6', label: 'School or University', automationId: 'searchBox', type: 'text' },
      { id: 'f7', label: 'Degree', automationId: 'degree', type: 'select' },
      { id: 'f8', label: 'Field of Study', automationId: 'searchBox', type: 'text' },
      { id: 'f9', label: 'Type to Add Skills', automationId: 'searchBox', type: 'multiselect' },
      // Non-input utility elements that must be filtered out
      { id: 'f10', label: 'utilityMenuButton', automationId: 'utilityMenuButton', type: 'button' },
      { id: 'f11', label: 'Upload a file (5MB max)', automationId: 'fileUpload', type: 'button' },
      { id: 'f12', label: 'Delete Amol_Sonawane_Resume.pdf', automationId: 'fileDelete', type: 'button' }
    ];

    const results = mapFieldsHeuristically(step2Fields, candidateProfile);

    // Utility buttons should be filtered out
    expect(results.length).toBe(9);

    expect(results.find(r => r.id === 'f1').value).toBe('Full Stack Developer');
    expect(results.find(r => r.id === 'f2').value).toBe('SevenMentor Corporate Services Pvt. Ltd.');
    expect(results.find(r => r.id === 'f3').value).toBe('11');
    expect(results.find(r => r.id === 'f4').value).toBe('2024');
    expect(results.find(r => r.id === 'f5').value).toContain('Developed responsive web applications');
    expect(results.find(r => r.id === 'f5').value).toContain('Built REST APIs');
    expect(results.find(r => r.id === 'f6').value).toBe('Brijlal Biyani Science College');
    expect(results.find(r => r.id === 'f7').value).toBe('Bachelor in Computer Applications (BCA)');
    expect(results.find(r => r.id === 'f8').value).toBe('Computer Applications');
    expect(results.find(r => r.id === 'f9').value).toContain('React.js');
    expect(results.find(r => r.id === 'f9').value).toContain('JavaScript');
  });
});
