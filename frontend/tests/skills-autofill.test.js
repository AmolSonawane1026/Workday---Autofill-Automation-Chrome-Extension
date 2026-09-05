// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeSkillName,
  isSkillMatch,
  cleanAndSanitizeSkills,
  clearInputWithBackspace,
  getVisibleSkillOptions,
  isOptionChecked,
  clickSkillOption,
  verifySkillSelected,
  fillWorkdaySkills
} from '../src/content/filler.js';

describe('Workday Skills Autofill Suite', () => {
  describe('Skill Name Normalization & Matching Logic', () => {
    it('normalizes skill names correctly', () => {
      expect(normalizeSkillName('React')).toBe('react');
      expect(normalizeSkillName('React.js')).toBe('reactjs');
      expect(normalizeSkillName('React JS')).toBe('reactjs');
      expect(normalizeSkillName('Node.js')).toBe('nodejs');
      expect(normalizeSkillName('Next.js')).toBe('nextjs');
      expect(normalizeSkillName('C++')).toBe('c++');
    });

    it('matches exact and equivalent JS technology names', () => {
      expect(isSkillMatch('React', 'React')).toBe(true);
      expect(isSkillMatch('React', 'React.js')).toBe(true);
      expect(isSkillMatch('React', 'ReactJS')).toBe(true);
      expect(isSkillMatch('React.js', 'React')).toBe(true);
      expect(isSkillMatch('Node.js', 'Node.js')).toBe(true);
      expect(isSkillMatch('Node.js', 'NodeJS')).toBe(true);
      expect(isSkillMatch('Node', 'Node.js')).toBe(true);
      expect(isSkillMatch('Next.js', 'Next.js')).toBe(true);
      expect(isSkillMatch('JavaScript', 'JavaScript')).toBe(true);
      expect(isSkillMatch('JavaScript', 'JS')).toBe(true);
      expect(isSkillMatch('MongoDB', 'Mongo')).toBe(true);
      expect(isSkillMatch('C++', 'CPP')).toBe(true);
    });

    it('matches Workday taxonomy labels with parenthetical classifications and acronyms', () => {
      expect(isSkillMatch('Python', 'Python (Programming Language)')).toBe(true);
      expect(isSkillMatch('MongoDB', 'MongoDB (Database)')).toBe(true);
      expect(isSkillMatch('SQL', 'SQL (Structured Query Language)')).toBe(true);
      expect(isSkillMatch('AWS', 'Amazon Web Services (AWS)')).toBe(true);
      expect(isSkillMatch('Docker', 'Docker (Software)')).toBe(true);
      expect(isSkillMatch('Django', 'Django (Web Framework)')).toBe(true);
      expect(isSkillMatch('FastAPI', 'FastAPI (Framework)')).toBe(true);
      expect(isSkillMatch('React.js', 'React (JavaScript Library)')).toBe(true);
      expect(isSkillMatch('React', 'React (JavaScript Library)')).toBe(true);
      expect(isSkillMatch('Redis', 'Redis (Software)')).toBe(true);
      expect(isSkillMatch('Postman', 'Postman (Software)')).toBe(true);
    });

    it('strictly guards against false positive partial/unrelated matches', () => {
      // Must NOT match different technologies just because they share a root word
      expect(isSkillMatch('React', 'React Native')).toBe(false);
      expect(isSkillMatch('React', 'React VR')).toBe(false);
      expect(isSkillMatch('React', 'React Redux')).toBe(false);
      expect(isSkillMatch('React', 'ReAct Framework')).toBe(false);
      expect(isSkillMatch('React', 'Flow Reactors')).toBe(false);
      expect(isSkillMatch('Java', 'JavaScript')).toBe(false);
      expect(isSkillMatch('C', 'C++')).toBe(false);
      expect(isSkillMatch('C', 'C#')).toBe(false);
      expect(isSkillMatch('Vue', 'Express.js')).toBe(false);
    });

    it('cleans and sanitizes complex and fragmented resume skills', () => {
      const rawSkills = [
        'Node.js',
        'Authentication (JWT',
        'OAuth)',
        'React.js (v18)',
        'Next.js (v14)',
        'JavaScript (ES6+)',
        'Web-',
        'Sockets',
        'Python (Django',
        'Flask',
        'FastAPI)',
        'AWS (EC2',
        'S3',
        'Cloudfront CDN)',
        'Lang-'
      ];

      const cleaned = cleanAndSanitizeSkills(rawSkills);
      expect(cleaned).toContain('Node.js');
      expect(cleaned).toContain('Authentication');
      expect(cleaned).toContain('JWT');
      expect(cleaned).toContain('OAuth');
      expect(cleaned).toContain('React.js');
      expect(cleaned).toContain('Next.js');
      expect(cleaned).toContain('JavaScript');
      expect(cleaned).toContain('WebSockets');
      expect(cleaned).toContain('Python');
      expect(cleaned).toContain('Django');
      expect(cleaned).toContain('Flask');
      expect(cleaned).toContain('FastAPI');
      expect(cleaned).toContain('AWS');
      expect(cleaned).toContain('EC2');
      expect(cleaned).toContain('Cloudfront CDN');
      expect(cleaned).not.toContain('Web-');
      expect(cleaned).not.toContain('Lang-');
    });
  });

  describe('Workday DOM Skills Parsing & Verification (Live Workday DOM)', () => {
    const liveWorkdaySkillsHtml = `
      <div data-automation-id="formField-skills">
        <label for="skills-input">Skills</label>
        <div class="tag-container">
          <!-- Tag chips appear here once selected -->
        </div>
        <input data-automation-id="skillsSearchBox" id="skills-input" placeholder="Type to Add Skills" value="" />
      </div>

      <div data-automation-id="activeListContainer" aria-activedescendant="menuItem-REMOTE_SKILL-1-347820" aria-label="Options Expanded" role="listbox">
        <div class="ReactVirtualized__Grid__innerScrollContainer" role="presentation">
          
          <!-- Option 1: React.js -->
          <div aria-setsize="30" id="menuItem-REMOTE_SKILL-1-347820" data-automation-id="menuItem" role="option" aria-label="React.js not checked">
            <div data-automation-id="promptLeafNode" data-automation-checked="Not Checked" data-uxi-widget-type="multiselectlistitem" data-uxi-multiselectlistitem-isselected="false">
              <div data-automation-id="checkbox" data-automationcheckboxchecked="false">
                <input type="checkbox" aria-checked="false" id="n9g4p6" data-automation-id="checkboxPanel">
              </div>
              <div id="promptOption-1" data-automation-id="promptOption" data-automation-label="React.js">React.js</div>
            </div>
          </div>

          <!-- Option 2: React VR -->
          <div aria-setsize="30" id="menuItem-REMOTE_SKILL-1-348802" data-automation-id="menuItem" role="option" aria-label="React VR not checked">
            <div data-automation-id="promptLeafNode" data-automation-checked="Not Checked" data-uxi-widget-type="multiselectlistitem" data-uxi-multiselectlistitem-isselected="false">
              <div data-automation-id="checkbox" data-automationcheckboxchecked="false">
                <input type="checkbox" aria-checked="false" id="n9g4p7" data-automation-id="checkboxPanel">
              </div>
              <div id="promptOption-2" data-automation-id="promptOption" data-automation-label="React VR">React VR</div>
            </div>
          </div>

          <!-- Option 3: Vue.js -->
          <div aria-setsize="30" id="menuItem-REMOTE_SKILL-1-351526" data-automation-id="menuItem" role="option" aria-label="Vue.js not checked">
            <div data-automation-id="promptLeafNode" data-automation-checked="Not Checked" data-uxi-widget-type="multiselectlistitem" data-uxi-multiselectlistitem-isselected="false">
              <div data-automation-id="checkbox" data-automationcheckboxchecked="false">
                <input type="checkbox" aria-checked="false" id="n9g4ph" data-automation-id="checkboxPanel">
              </div>
              <div id="promptOption-3" data-automation-id="promptOption" data-automation-label="Vue.js">Vue.js</div>
            </div>
          </div>

          <!-- Option 4: React Native -->
          <div aria-setsize="30" id="menuItem-REMOTE_SKILL-1-350519" data-automation-id="menuItem" role="option" aria-label="React Native not checked">
            <div data-automation-id="promptLeafNode" data-automation-checked="Not Checked" data-uxi-widget-type="multiselectlistitem" data-uxi-multiselectlistitem-isselected="false">
              <div data-automation-id="checkbox" data-automationcheckboxchecked="false">
                <input type="checkbox" aria-checked="false" id="n9g4pl" data-automation-id="checkboxPanel">
              </div>
              <div id="promptOption-4" data-automation-id="promptOption" data-automation-label="React Native">React Native</div>
            </div>
          </div>

        </div>
      </div>
    `;

    beforeEach(() => {
      document.body.innerHTML = liveWorkdaySkillsHtml;
    });

    it('correctly parses visible skill options and their initial unchecked state', () => {
      const options = getVisibleSkillOptions();
      expect(options.length).toBe(4);
      expect(options[0].labelText).toBe('React.js');
      expect(options[0].isChecked).toBe(false);
      expect(options[1].labelText).toBe('React VR');
      expect(options[2].labelText).toBe('Vue.js');
      expect(options[3].labelText).toBe('React Native');
    });

    it('clicks skill checkbox option and verifies updated selection', () => {
      const options = getVisibleSkillOptions();
      const reactOpt = options.find(o => isSkillMatch('React', o.labelText));
      expect(reactOpt).toBeDefined();
      expect(reactOpt.labelText).toBe('React.js');

      // Click the checkbox
      clickSkillOption(reactOpt);

      // Simulate Workday updating its DOM attributes on select
      reactOpt.checkboxInput.checked = true;
      reactOpt.checkboxInput.setAttribute('aria-checked', 'true');
      const container = document.querySelector('[data-automation-id="formField-skills"]');
      const tag = document.createElement('div');
      tag.setAttribute('data-automation-id', 'selectedItem');
      tag.textContent = 'React.js';
      container.querySelector('.tag-container').appendChild(tag);

      // Verification
      const isVerified = verifySkillSelected('React', 'React.js', container);
      expect(isVerified).toBe(true);
    });

    it('does not click or toggle an option if it is already checked', () => {
      const options = getVisibleSkillOptions();
      const reactOpt = options[0];
      reactOpt.checkboxInput.checked = true;
      reactOpt.checkboxInput.setAttribute('aria-checked', 'true');

      let clicked = false;
      reactOpt.checkboxInput.addEventListener('click', () => { clicked = true; });

      const clickResult = clickSkillOption(reactOpt);
      expect(clickResult).toBe(false);
      expect(clicked).toBe(false);
    });

    it('runs fillWorkdaySkills sequentially with accurate status reporting', async () => {
      const searchInput = document.querySelector('input[data-automation-id="skillsSearchBox"]');
      const container = document.querySelector('[data-automation-id="formField-skills"]');

      // Intercept click to simulate Workday updating checkbox and adding tag
      const originalClick = HTMLElement.prototype.click;
      HTMLElement.prototype.click = function() {
        if (this.getAttribute('data-automation-id') === 'checkboxPanel' || this.type === 'checkbox') {
          this.checked = true;
          this.setAttribute('aria-checked', 'true');
          const tag = document.createElement('div');
          tag.setAttribute('data-automation-id', 'selectedItem');
          tag.textContent = 'React.js';
          container.querySelector('.tag-container')?.appendChild(tag);
        }
        originalClick.call(this);
      };

      const result = await fillWorkdaySkills(['React', 'Golang'], searchInput);
      HTMLElement.prototype.click = originalClick;

      expect(result.total).toBe(2);
      expect(result.selected).toBe(1); // React matched and verified
      expect(result.notFound).toBe(1); // Golang not in dropdown
      expect(result.results[0]).toEqual({
        skill: 'React',
        status: 'selected',
        matchedOption: 'React.js'
      });
      expect(result.results[1]).toEqual({
        skill: 'Golang',
        status: 'not_found'
      });
    }, 15000);
  });
});
