"""
Workday Autonomous Selenium Automation Bot with LangChain & Gemini LLM Reasoning
Performs smart automated navigation, DOM analysis, geographic entity expansion,
dynamic section expansion, and precision field population for Workday portals.
"""

import os
import sys
import time
import json
import logging
from typing import Dict, Any, List, Optional
from geographic_reasoner import infer_geographic_details

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("WorkdaySeleniumBot")


class WorkdaySeleniumBot:
    def __init__(self, headless: bool = False, chrome_driver_path: Optional[str] = None):
        self.headless = headless
        self.driver_path = chrome_driver_path
        self.driver = None

    def initialize_driver(self):
        """Initializes Chrome WebDriver with production-grade stability options."""
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.chrome.service import Service

            options = Options()
            if self.headless:
                options.add_argument("--headless=new")
            options.add_argument("--disable-gpu")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--window-size=1920,1080")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option("useAutomationExtension", False)

            self.driver = webdriver.Chrome(options=options)
            logger.info("✅ Selenium Chrome WebDriver initialized successfully")
            return self.driver
        except Exception as e:
            logger.error(f"Failed to start Selenium WebDriver: {e}")
            raise

    def open_url(self, url: str):
        """Navigates to the specified Workday job portal."""
        if not self.driver:
            self.initialize_driver()
        logger.info(f"Navigating to Workday URL: {url}")
        self.driver.get(url)
        time.sleep(3)

    def _set_input_value(self, element, value: str):
        """Sets an input value with Javascript prototype setter and native events for React compatibility."""
        if not element or value is None:
            return
        val_str = str(value)
        try:
            self.driver.execute_script("""
                const el = arguments[0];
                const val = arguments[1];
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                el.focus();
                const prototype = el.tagName.toLowerCase() === 'textarea' 
                    ? window.HTMLTextAreaElement.prototype 
                    : window.HTMLInputElement.prototype;
                const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
                if (valueSetter) {
                    valueSetter.call(el, val);
                } else {
                    el.value = val;
                }
                el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
            """, element, val_str)
        except Exception as e:
            try:
                element.clear()
                element.send_keys(val_str)
            except Exception:
                pass

    def _select_custom_dropdown(self, container_element, target_value: str):
        """Selects an option in Workday's custom popup listbox."""
        if not container_element or not target_value:
            return False
        try:
            self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", container_element)
            container_element.click()
            time.sleep(0.4)

            from selenium.webdriver.common.by import By
            from selenium.webdriver.common.keys import Keys

            options = self.driver.find_elements(By.XPATH, "//div[@role='listbox']//*[@role='option'] | //li[@role='option'] | //div[contains(@data-automation-id, 'promptOption')] | //div[contains(@class, 'wd-popup')]//*[@role='option']")
            target_lower = target_value.lower().strip()

            best_opt = None
            for opt in options:
                text = opt.text.strip().lower()
                if text == target_lower or target_lower in text:
                    best_opt = opt
                    break

            if best_opt:
                self.driver.execute_script("arguments[0].click();", best_opt)
                time.sleep(0.3)
                return True

            # If not found directly, check search input
            search_inputs = self.driver.find_elements(By.XPATH, "//div[@role='listbox']//input | //div[contains(@class, 'wd-popup')]//input")
            if search_inputs:
                search_inputs[0].send_keys(target_value)
                search_inputs[0].send_keys(Keys.ENTER)
                time.sleep(0.4)
                filtered_opts = self.driver.find_elements(By.XPATH, "//div[@role='listbox']//*[@role='option'] | //div[contains(@data-automation-id, 'promptOption')]")
                if filtered_opts:
                    self.driver.execute_script("arguments[0].click();", filtered_opts[0])
                    time.sleep(0.3)
                    return True

            # Press Escape to close popup if unselected
            self.driver.find_element(By.TAG_NAME, "body").send_keys(Keys.ESCAPE)
            return False
        except Exception as e:
            logger.debug(f"Custom dropdown select exception: {e}")
            return False

    def fill_application_step(self, profile: Dict[str, Any], resume_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Scans the active Workday page, performs LLM & geographic reasoning,
        and fills all detected fields accurately.
        """
        if not self.driver:
            raise RuntimeError("WebDriver not initialized")

        from selenium.webdriver.common.by import By
        from selenium.webdriver.common.keys import Keys

        personal = profile.get("personalInfo", {})
        addr = personal.get("address", {})
        
        # 1. Geographic Reasoning
        loc_query = f"{addr.get('city', '')} {addr.get('state', '')} {addr.get('country', '')}".strip()
        geo = infer_geographic_details(loc_query) if loc_query else {}

        first_name = personal.get("firstName", "")
        last_name = personal.get("lastName", "")
        email = personal.get("email", "")
        linkedin_url = personal.get("linkedIn", "")
        github_url = personal.get("github", "")
        portfolio_url = personal.get("portfolio", "")
        
        # Clean local phone number
        raw_phone = personal.get("phone", "")
        clean_phone = "".join(filter(str.isdigit, raw_phone))
        if len(clean_phone) == 12 and clean_phone.startswith("91"):
            clean_phone = clean_phone[2:]
        elif len(clean_phone) == 11 and clean_phone.startswith("1"):
            clean_phone = clean_phone[1:]

        city = geo.get("city") or addr.get("city", "")
        state = geo.get("state") or addr.get("state", "")
        country = geo.get("country") or addr.get("country", "India")
        postal = geo.get("postalCode") or addr.get("postalCode", "")
        country_code = geo.get("countryPhoneCode") or personal.get("countryPhoneCode", "India (+91)")

        filled_count = 0

        # Fill Text Inputs & Textareas
        inputs = self.driver.find_elements(By.XPATH, "//input | //textarea")
        for inp in inputs:
            try:
                auto_id = (inp.get_attribute("data-automation-id") or inp.get_attribute("id") or inp.get_attribute("name") or "").lower()
                aria_lbl = (inp.get_attribute("aria-label") or "").lower()
                inp_type = (inp.get_attribute("type") or "text").lower()
                tag_name = inp.tag_name.lower()

                if inp_type in ["hidden", "password", "file", "submit"]:
                    continue

                if "extension" in auto_id or "extension" in aria_lbl:
                    continue
                elif "firstname" in auto_id or "localgivenname" in auto_id or "first name" in aria_lbl:
                    self._set_input_value(inp, first_name)
                    filled_count += 1
                elif "lastname" in auto_id or "localfamilyname" in auto_id or "last name" in aria_lbl:
                    self._set_input_value(inp, last_name)
                    filled_count += 1
                elif "email" in auto_id or inp_type == "email" or "email" in aria_lbl:
                    self._set_input_value(inp, email)
                    filled_count += 1
                elif ("phonenumber" in auto_id or "phone" in auto_id or inp_type == "tel" or "phone" in aria_lbl) and "code" not in auto_id and "device" not in auto_id:
                    self._set_input_value(inp, clean_phone)
                    filled_count += 1
                elif "addressline1" in auto_id or "street" in auto_id or "address line 1" in aria_lbl:
                    self._set_input_value(inp, addr.get("street") or f"{city}, {state}")
                    filled_count += 1
                elif "city" in auto_id or "city" in aria_lbl:
                    self._set_input_value(inp, city)
                    filled_count += 1
                elif "postalcode" in auto_id or "zip" in auto_id or "postal" in aria_lbl:
                    self._set_input_value(inp, postal)
                    filled_count += 1
                elif "linkedin" in auto_id or "linkedin" in aria_lbl:
                    if linkedin_url:
                        self._set_input_value(inp, linkedin_url)
                        filled_count += 1
                elif "github" in auto_id or "github" in aria_lbl:
                    if github_url:
                        self._set_input_value(inp, github_url)
                        filled_count += 1
                elif "portfolio" in auto_id or "website" in auto_id or "portfolio" in aria_lbl:
                    if portfolio_url:
                        self._set_input_value(inp, portfolio_url)
                        filled_count += 1
            except Exception as e:
                logger.debug(f"Input fill skip: {e}")

        # Fill Custom Workday Comboboxes / Select Buttons
        dropdown_buttons = self.driver.find_elements(By.XPATH, "//button[@aria-haspopup='listbox'] | //div[@role='combobox'] | //button[contains(@data-automation-id, 'prompt')]")
        for btn in dropdown_buttons:
            try:
                auto_id = (btn.get_attribute("data-automation-id") or "").lower()
                aria_lbl = (btn.get_attribute("aria-label") or btn.text or "").lower()

                if "countryphonecode" in auto_id or "phonecode" in auto_id or "phone code" in aria_lbl:
                    if self._select_custom_dropdown(btn, country_code):
                        filled_count += 1
                elif "device" in auto_id or "device" in aria_lbl:
                    if self._select_custom_dropdown(btn, "Mobile"):
                        filled_count += 1
                elif "countryregion" in auto_id or "state" in auto_id or "state" in aria_lbl or "province" in aria_lbl:
                    if state and self._select_custom_dropdown(btn, state):
                        filled_count += 1
                elif ("country" in auto_id or "country" in aria_lbl) and "phone" not in auto_id and "region" not in auto_id:
                    if country and self._select_custom_dropdown(btn, country):
                        filled_count += 1
                elif "hearaboutus" in auto_id or "source" in auto_id or "source" in aria_lbl or "how did you hear" in aria_lbl:
                    if not self._select_custom_dropdown(btn, "Naukri"):
                        self._select_custom_dropdown(btn, "Job Board")
                    filled_count += 1
            except Exception as e:
                logger.debug(f"Dropdown button skip: {e}")

        # Expand Work Experience & Education Sections if Add button exists
        experiences = profile.get("workExperience", [])
        educations = profile.get("education", [])

        if experiences or educations:
            add_buttons = self.driver.find_elements(By.XPATH, "//button[contains(translate(text(), 'ADD', 'add'), 'add')]")
            for btn in add_buttons:
                try:
                    if btn.is_displayed():
                        btn.click()
                        time.sleep(0.5)
                except Exception:
                    pass

            # Fill Experience Inputs
            if experiences:
                exp = experiences[0]
                job_title_inputs = self.driver.find_elements(By.XPATH, "//input[contains(@data-automation-id, 'jobTitle') or contains(@aria-label, 'Job Title')]")
                company_inputs = self.driver.find_elements(By.XPATH, "//input[contains(@data-automation-id, 'company') or contains(@aria-label, 'Company')]")
                location_inputs = self.driver.find_elements(By.XPATH, "//input[contains(@data-automation-id, 'location') or contains(@aria-label, 'Location')]")
                
                if job_title_inputs and exp.get("jobTitle"):
                    self._set_input_value(job_title_inputs[0], exp.get("jobTitle"))
                    filled_count += 1
                if company_inputs and exp.get("company"):
                    self._set_input_value(company_inputs[0], exp.get("company"))
                    filled_count += 1
                if location_inputs and exp.get("location"):
                    self._set_input_value(location_inputs[0], exp.get("location"))
                    filled_count += 1

            # Fill Education Inputs
            if educations:
                edu = educations[0]
                school_inputs = self.driver.find_elements(By.XPATH, "//input[contains(@data-automation-id, 'school') or contains(@aria-label, 'School') or contains(@aria-label, 'University')]")
                degree_inputs = self.driver.find_elements(By.XPATH, "//input[contains(@data-automation-id, 'degree') or contains(@aria-label, 'Degree')]")
                field_inputs = self.driver.find_elements(By.XPATH, "//input[contains(@data-automation-id, 'fieldOfStudy') or contains(@aria-label, 'Field of Study')]")

                if school_inputs and edu.get("institution"):
                    self._set_input_value(school_inputs[0], edu.get("institution"))
                    filled_count += 1
                if degree_inputs and edu.get("degree"):
                    self._set_input_value(degree_inputs[0], edu.get("degree"))
                    filled_count += 1
                if field_inputs and edu.get("fieldOfStudy"):
                    self._set_input_value(field_inputs[0], edu.get("fieldOfStudy"))
                    filled_count += 1

        # Handle Skills Multi-select
        skills_inputs = self.driver.find_elements(By.XPATH, "//*[contains(@data-automation-id, 'skills')]//input | //input[contains(@data-automation-id, 'searchBox')]")
        if skills_inputs:
            skills = profile.get("skills", {}).get("technical", ["React.js", "JavaScript", "Python", "Node.js", "FastAPI"])
            target_input = skills_inputs[0]
            for skill in skills[:10]:
                try:
                    target_input.send_keys(skill)
                    time.sleep(0.3)
                    target_input.send_keys(Keys.ENTER)
                    time.sleep(0.2)
                    filled_count += 1
                except Exception:
                    pass

        # Check Terms / Agreement Checkbox if present
        terms_checkboxes = self.driver.find_elements(By.XPATH, "//input[@type='checkbox' and (contains(@data-automation-id, 'terms') or contains(@data-automation-id, 'consent') or contains(@data-automation-id, 'agree'))]")
        for cb in terms_checkboxes:
            try:
                if not cb.is_selected():
                    cb.click()
                    filled_count += 1
            except Exception:
                pass

        # Upload Resume PDF if path provided
        if resume_path and os.path.exists(resume_path):
            file_inputs = self.driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
            if file_inputs:
                try:
                    file_inputs[0].send_keys(os.path.abspath(resume_path))
                    logger.info(f"📄 Uploaded resume file via Selenium: {resume_path}")
                    filled_count += 1
                except Exception as fe:
                    logger.warning(f"File upload via Selenium failed: {fe}")

        return {
            "status": "success",
            "filledFields": filled_count,
            "geographicContext": geo
        }

    def close(self):
        """Closes the Selenium browser session."""
        if self.driver:
            self.driver.quit()
            self.driver = None
            logger.info("Selenium driver closed")


if __name__ == "__main__":
    bot = WorkdaySeleniumBot(headless=False)
    sample_profile = {
        "personalInfo": {
            "firstName": "Alex",
            "lastName": "Rivers",
            "email": "alex.rivers@example.com",
            "phone": "+1 (408) 555-0142",
            "address": {"city": "Santa Clara", "country": "United States of America"}
        },
        "skills": {"technical": ["React.js", "JavaScript", "Python", "FastAPI", "Node.js"]}
    }
    logger.info("Workday Selenium Bot ready for autonomous execution")
