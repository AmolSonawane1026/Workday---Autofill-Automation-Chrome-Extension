// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { extractFormFields } from '../src/content/extractor.js';
import { mapFieldsHeuristically } from '../src/core/ai/field-mapper.js';

describe('Workday DOM Extraction & Mapping against Live Workday HTML', () => {
  const liveWorkdayHtml = `
    <div class="css-g7hkny">
      <h3 tabindex="-1" class="css-1ylcaf3">My Information</h3>
      <div data-automation-id="applyFlowMyInfoPage">
        <div role="group" aria-labelledby="source-section">
          <div data-fkit-id="source--null" class="css-1obf64m">
            <div data-automation-id="formField-source" data-fkit-id="source--source" class="css-7t35fz">
              <label for="source--source" class="css-1ud5i8o"><span>How Did You Hear About Us?<abbr aria-hidden="true" class="css-1fc83zd">*</abbr></span></label>
              <div class="css-15rz5ap">
                <div>
                  <div class="css-1sw7cgs">
                    <div dir="ltr" tabindex="-1" data-automation-id="multiSelectContainer" id="3a892fc6-5e57-4cfa-b9e3-8c41305424c5" data-uxi-element-id="3a892fc6-5e57-4cfa-b9e3-8c41305424c5" data-uxi-widget-type="multiselect" class="css-68zbsl">
                      <div data-automation-id="multiselectInputContainer" dir="ltr" color="#CC0000" class="css-1el2jku">
                        <div tabindex="-1" class="css-14lkp70">
                          <ul role="listbox" tabindex="-1" data-automation-id="selectedItemList" aria-label="items selected">
                            <li role="presentation" data-automation-id="menuItem">
                              <div class="me7hck" id="pill-1" tabindex="-1" role="option" data-automation-id="selectedItem" dir="ltr">
                                <div class="css-e7hcp" data-automation-id="DELETE_charm"></div>
                                <p class="css-e7hcv" data-automation-id="promptOption" data-automation-label="Pandora">Pandora</p>
                              </div>
                            </li>
                          </ul>
                        </div>
                        <div data-automation-hiddensearch="true" class="css-1lyptf2" data-automation-id="monikerSearchBox">
                          <input enterkeyhint="search" dir="ltr" placeholder="Search" aria-required="true" id="source--source" class="css-1giiucd" value="" data-automation-id="searchBox">
                        </div>
                        <span class="css-12ds82q" data-automation-id="promptSearchButton" data-uxi-widget-type="selectinputicon"></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div role="group" aria-labelledby="previousWorker-section">
          <div data-fkit-id="previousWorker--null" class="css-1obf64m">
            <div data-automation-id="formField-candidateIsPreviousWorker" class="css-gvoll6">
              <fieldset class="css-1s9yhc">
                <legend><label id="radio-label1" class="css-1ud5i8o"><span>Have you previously worked for Target as a team member?<abbr aria-hidden="true" class="css-1fc83zd">*</abbr></span></label></legend>
                <div class="css-15rz5ap">
                  <div name="candidateIsPreviousWorker" id="previousWorker--candidateIsPreviousWorker" aria-required="true">
                    <div class="css-1utp272">
                      <input id="ym0m2" name="candidateIsPreviousWorker" type="radio" value="true">
                      <label for="ym0m2" class="css-1ifmyht">Yes</label>
                    </div>
                    <div class="css-1utp272">
                      <input id="ym0m3" name="candidateIsPreviousWorker" type="radio" value="false" checked="">
                      <label for="ym0m3" class="css-1ifmyht">No</label>
                    </div>
                  </div>
                </div>
              </fieldset>
            </div>
          </div>
        </div>

        <div role="group" aria-labelledby="country-section">
          <div data-fkit-id="country--null" class="css-1obf64m">
            <div data-automation-id="formField-country" data-fkit-id="country--country" class="css-7t35fz">
              <label for="country--country" class="css-1ud5i8o"><span>Country<abbr aria-hidden="true" class="css-1fc83zd">*</abbr></span></label>
              <div class="css-15rz5ap">
                <button aria-haspopup="listbox" type="button" name="country" id="country--country">British Indian Ocean Territory</button>
              </div>
            </div>
          </div>
        </div>

        <div role="group" aria-labelledby="Legal-Name-section">
          <h4 id="Legal-Name-section">Legal Name</h4>
          <div data-automation-id="formField-legalName--firstName" class="css-7t35fz">
            <label for="name--legalName--firstName"><span>Given Name<abbr aria-hidden="true">*</abbr></span></label>
            <input type="text" id="name--legalName--firstName" name="legalName--firstName" aria-required="true" value="Amol">
          </div>
          <div data-automation-id="formField-legalName--lastName" class="css-7t35fz">
            <label for="name--legalName--lastName"><span>Family Name<abbr aria-hidden="true">*</abbr></span></label>
            <input type="text" id="name--legalName--lastName" name="legalName--lastName" aria-required="true" value="Sonawane">
          </div>
          <div data-automation-id="formField-preferredCheck" class="css-7t35fz">
            <label for="name--preferredCheck">I have a preferred name</label>
            <input id="name--preferredCheck" type="checkbox" name="preferredCheck">
          </div>
        </div>

        <div role="group" aria-labelledby="Address-section">
          <div data-automation-id="formField-addressLine1" class="css-7t35fz">
            <label for="address--addressLine1">Address Line 1</label>
            <input type="text" id="address--addressLine1" name="addressLine1" value="Tower 02, Manyata Embassy Business Park, Outer Ring Rd">
          </div>
          <div data-automation-id="formField-city" class="css-7t35fz">
            <label for="address--city">City</label>
            <input type="text" id="address--city" name="city" value="Bangalore">
          </div>
          <div data-automation-id="formField-postalCode" class="css-7t35fz">
            <label for="address--postalCode">Postal Code</label>
            <input type="text" id="address--postalCode" name="postalCode" value="560045">
          </div>
        </div>

        <div role="group" aria-labelledby="Phone-section">
          <div data-automation-id="formField-phoneType" class="css-7t35fz">
            <label for="phoneNumber--phoneType"><span>Phone Device Type<abbr aria-hidden="true">*</abbr></span></label>
            <button aria-haspopup="listbox" type="button" name="phoneType" id="phoneNumber--phoneType">Mobile</button>
          </div>
          <div data-automation-id="formField-countryPhoneCode" class="css-7t35fz">
            <label for="phoneNumber--countryPhoneCode"><span>Country Phone Code<abbr aria-hidden="true">*</abbr></span></label>
            <div dir="ltr" tabindex="-1" data-automation-id="multiSelectContainer" data-uxi-widget-type="multiselect">
              <input enterkeyhint="search" id="phoneNumber--countryPhoneCode" value="">
              <ul role="listbox" data-automation-id="selectedItemList">
                <li role="presentation" data-automation-id="menuItem">
                  <div data-automation-id="selectedItem" role="option">
                    <p data-automation-id="promptOption">Albania (+355)</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <div data-automation-id="formField-phoneNumber" class="css-7t35fz">
            <label for="phoneNumber--phoneNumber"><span>Phone Number<abbr aria-hidden="true">*</abbr></span></label>
            <input type="text" id="phoneNumber--phoneNumber" name="phoneNumber" value="9876543210">
          </div>
          <div data-automation-id="formField-extension" class="css-7t35fz">
            <label for="phoneNumber--extension">Phone Extension</label>
            <input type="text" id="phoneNumber--extension" name="extension" value="91">
          </div>
        </div>
      </div>
    </div>
  `;

  let container;

  beforeEach(() => {
    document.body.innerHTML = liveWorkdayHtml;
    container = document.querySelector('.css-g7hkny');
  });

  it('accurately identifies and classifies all Workday fields from live DOM', () => {
    const fields = extractFormFields(container);

    // 1. Check Source MultiSelect
    const sourceField = fields.find(f => f.automationId.includes('source') || f.label.includes('How Did You Hear'));
    expect(sourceField).toBeDefined();
    expect(sourceField.type).toBe('multiselect');
    expect(sourceField.currentValue).toBe('Pandora');

    // 2. Check Previous Worker Radio
    const prevWorkerField = fields.find(f => f.type === 'radio');
    expect(prevWorkerField).toBeDefined();
    expect(prevWorkerField.label).toContain('previously worked');
    expect(prevWorkerField.currentValue).toBe('false');

    // 3. Check Country dropdown button
    const countryField = fields.find(f => f.automationId.includes('country') && f.type === 'select');
    expect(countryField).toBeDefined();
    expect(countryField.currentValue).toBe('British Indian Ocean Territory');

    // 4. Check Legal Name fields
    const firstName = fields.find(f => f.automationId.includes('firstName') || f.label.includes('Given Name'));
    const lastName = fields.find(f => f.automationId.includes('lastName') || f.label.includes('Family Name'));
    expect(firstName).toBeDefined();
    expect(firstName.currentValue).toBe('Amol');
    expect(lastName).toBeDefined();
    expect(lastName.currentValue).toBe('Sonawane');

    // 5. Check Country Phone Code MultiSelect
    const phoneCodeField = fields.find(f => f.automationId.includes('countryPhoneCode') || f.label.includes('Country Phone Code'));
    expect(phoneCodeField).toBeDefined();
    expect(phoneCodeField.type).toBe('multiselect');
    expect(phoneCodeField.currentValue).toBe('Albania (+355)');

    // 6. Check Phone Number
    const phoneNumField = fields.find(f => f.automationId === 'formField-phoneNumber' || f.name === 'phoneNumber');
    expect(phoneNumField).toBeDefined();
    expect(phoneNumField.currentValue).toBe('9876543210');
  });

  it('accurately maps fields to profile values using heuristic mapper with smart geo reasoning', () => {
    const fields = extractFormFields(container);
    const profile = {
      personal: {
        first_name: 'Amol',
        last_name: 'Sonawane',
        email: 'pro.amolsonawane@gmail.com',
        phone: '+91 9876543210',
        location: 'Pune, Maharashtra, India'
      },
      education: [
        {
          degree: 'BCA',
          institution: 'Pune University',
          graduation_year: 2023
        }
      ],
      experience: [
        {
          company: 'Tech Corp',
          title: 'React Developer',
          start_date: '2023-01',
          end_date: null,
          description: 'Frontend engineer'
        }
      ],
      skills: ['React', 'JavaScript', 'Next.js', 'Node.js', 'MongoDB'],
      links: {
        linkedin: 'https://linkedin.com/in/amolsonawane',
        github: 'https://github.com/amolsonawane'
      },
      workAuthorization: {
        authorizedInTargetCountry: true,
        requiresSponsorship: false
      }
    };

    const mapped = mapFieldsHeuristically(fields, profile);

    // Source -> Defaults to Job Board to satisfy required field
    const sourceMap = mapped.find(m => m.label.includes('How Did You Hear') || m.automationId.includes('source'));
    expect(sourceMap.value).toBe('Job Board');

    // Previous Worker -> No
    const prevWorkerMap = mapped.find(m => m.label.includes('previously worked'));
    expect(prevWorkerMap.value).toBe('No');

    // First & Last Name
    const fNameMap = mapped.find(m => m.label.includes('Given Name'));
    const lNameMap = mapped.find(m => m.label.includes('Family Name'));
    expect(fNameMap.value).toBe('Amol');
    expect(lNameMap.value).toBe('Sonawane');

    // Country Dropdown -> India (inferred from Pune, Maharashtra, India)
    const countryMap = mapped.find(m => m.automationId === 'formField-country' || (m.label === 'Country' && !m.label.includes('Phone')));
    expect(countryMap.value).toBe('India');

    // Country Phone Code -> India (+91)
    const phoneCodeMap = mapped.find(m => m.label.includes('Country Phone Code') || m.automationId.includes('countryPhoneCode'));
    expect(phoneCodeMap.value).toBe('India (+91)');

    // Phone Extension -> Empty (skipped)
    const extMap = mapped.find(m => m.label.includes('Extension') || m.automationId.includes('extension'));
    expect(extMap.value).toBe('');
  });
});
