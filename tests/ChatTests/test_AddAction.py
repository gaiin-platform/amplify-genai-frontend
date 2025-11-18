import unittest
import time
import os
import select
from dotenv import load_dotenv
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import (
    UnexpectedAlertPresentException,
    NoSuchElementException,
)
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.keys import Keys
from tests.base_test import BaseTest


class AddActionTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)
    
    @staticmethod 
    def normalize_text(s: str) -> str:
        """Collapse whitespace/newlines so DOM formatting differences don't break comparisons."""
        return " ".join(s.split()).strip()
        
    # ----------------- Test Presence -----------------
    """Test the Presence of all the elements in the Scheduled Tasks Modal"""

    def test_add_action_presence(self):
        # Extra sleep for extra loading
        time.sleep(3)
        
        add_action_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "addAction")))
        self.assertTrue(add_action_btn, "Add Action Button should be clickable")
        add_action_btn.click()
        time.sleep(3)
        
        tab_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabName")))
        self.assertGreater(len(tab_name_elements), 0, "There should be at least one Tab name element present")
        
        name_list = []
        tab_list = ["Actions", "Action Sets"]
        
        for tab_name_el in tab_name_elements:
            name_text = tab_name_el.text.strip()
            name_list.append(name_text)
        
        self.assertEqual(name_list, tab_list, "Tab lists should be equal")
        
        # id="apiOperationsSelect" click
        api_operation_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "apiOperationsSelect")))
        self.assertTrue(api_operation_btn, "API Operation Button should be clickable")
        api_operation_btn.click()
        time.sleep(2)
        
        # id="api-dropdown-menu" check presence of
        api_dropdown_menu = self.wait.until(EC.presence_of_element_located((By.ID, "api-dropdown-menu")))
        self.assertTrue(api_dropdown_menu, "API Dropdown Menu should be present")
        time.sleep(1)
        
        # id="customSelect" check presence of / can click
        custom_select_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "customSelect")))
        self.assertTrue(custom_select_btn, "Custom Select should be clickable in the dropdown menu")
        time.sleep(1)
        
        # id="internalSelect" check presence of / can click
        internal_select_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "internalSelect")))
        self.assertTrue(internal_select_btn, "Internal Select should be clickable in the dropdown menu")
        time.sleep(1)
        
        # id="toolsSelect" check presence of / can click
        tools_select_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "toolsSelect")))
        self.assertTrue(tools_select_btn, "Tools Select should be clickable in the dropdown menu")
        time.sleep(1)
        
        internal_select_btn.click()
        time.sleep(1)
        
        # id="nameTagToggle"
        name_toggle_btn = self.wait.until(EC.presence_of_element_located((By.ID, "nameTagToggle")))
        self.assertTrue(name_toggle_btn, "Name Toggle switch should be clickable in the dropdown menu")
        time.sleep(1)
        
        # id="SearchBar"
        search_bar = self.wait.until(EC.element_to_be_clickable((By.ID, "SearchBar")))
        self.assertTrue(search_bar, "Search bar should be clickable in the dropdown menu")
        time.sleep(1)
        
    # ----------------- Test Presence of API items and Tool Items -----------------
    """Test the Presence of all the elements in the Scheduled Tasks Modal"""

    def test_add_action_presence_api_and_tools(self):
        # Extra sleep for extra loading
        time.sleep(3)
        
        add_action_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "addAction")))
        self.assertTrue(add_action_btn, "Add Action Button should be clickable")
        add_action_btn.click()
        time.sleep(3)
        
        # id="apiOperationsSelect" click
        api_operation_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "apiOperationsSelect")))
        self.assertTrue(api_operation_btn, "API Operation Button should be clickable")
        api_operation_btn.click()
        time.sleep(2)
        
        # id="internalSelect" check presence of / can click
        internal_select_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "internalSelect")))
        self.assertTrue(internal_select_btn, "Internal Select should be clickable in the dropdown menu")
        time.sleep(1)
        
        internal_select_btn.click()
        time.sleep(1)
        
        # id="apiItem"
        api_item = self.wait.until(EC.presence_of_all_elements_located((By.ID, "apiItem")))
        self.assertTrue(api_item, "Selectable API elements should be visible")
        time.sleep(1)
        
        # id="apiClick"
        api_click = self.wait.until(EC.presence_of_all_elements_located((By.ID, "apiClick")))
        self.assertTrue(api_click, "Selectable API elements should be visible")
        time.sleep(1)
        
        # id="apiName"
        api_item = self.wait.until(EC.presence_of_all_elements_located((By.ID, "apiName")))
        self.assertTrue(api_item, "Selectable API elements should be visible")
        time.sleep(1)
        
        # id="apiOperationsSelect" click
        api_operation_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "apiOperationsSelect")))
        self.assertTrue(api_operation_btn, "API Operation Button should be clickable")
        api_operation_btn.click()
        time.sleep(2)
        
        # id="toolsSelect" check presence of / can click
        tools_select_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "toolsSelect")))
        self.assertTrue(tools_select_btn, "Tools Select should be clickable in the dropdown menu")
        time.sleep(1)
        
        tools_select_btn.click()
        time.sleep(1)
        
        # id="toolItem"
        tool_item = self.wait.until(EC.presence_of_all_elements_located((By.ID, "toolItem")))
        self.assertTrue(tool_item, "Selectable API elements should be visible")
        time.sleep(1)
        
         # id="toolClick"
        tool_click = self.wait.until(EC.presence_of_all_elements_located((By.ID, "toolClick")))
        self.assertTrue(tool_click, "Selectable API elements should be visible")
        time.sleep(1)
        
        # id="toolName"
        tool_item = self.wait.until(EC.presence_of_all_elements_located((By.ID, "toolName")))
        self.assertTrue(tool_item, "Selectable API elements should be visible")
        time.sleep(1)
        
    # # ----------------- Test View Action -----------------
    # """Test the Presence of all the elements in the Scheduled Tasks Modal"""

    # def test_view_action(self):
    #     # Extra sleep for extra loading
    #     time.sleep(3)
        
    #     add_action_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "addAction")))
    #     self.assertTrue(add_action_btn, "Add Action Button should be clickable")
    #     add_action_btn.click()
    #     time.sleep(3)
        
    #     # id="apiOperationsSelect" click
    #     api_operation_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "apiOperationsSelect")))
    #     self.assertTrue(api_operation_btn, "API Operation Button should be clickable")
    #     api_operation_btn.click()
    #     time.sleep(2)
        
    #     # id="api-dropdown-menu" check presence of
    #     api_dropdown_menu = self.wait.until(EC.presence_of_element_located((By.ID, "api-dropdown-menu")))
    #     self.assertTrue(api_dropdown_menu, "API Dropdown Menu should be present")
    #     time.sleep(1)
        
    #     # id="customSelect" check presence of / can click
    #     custom_select_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "customSelect")))
    #     self.assertTrue(custom_select_btn, "Custom Select should be clickable in the dropdown menu")
    #     time.sleep(1)
        
    #     custom_select_btn.click()
        
    #     # Find all apiItem elements
    #     api_items = self.wait.until(EC.presence_of_all_elements_located((By.ID, "apiItem")))
    #     self.assertTrue(api_items, "Selectable API elements should be visible")

    #     target_text = "Calculate_drake_equation"
    #     found = False

    #     for item in api_items:
    #         try:
    #             # Find the apiName element within this apiItem
    #             api_name = item.find_element(By.ID, "apiName")
                
    #             if api_name.text.strip() == target_text:
    #                 # Found the correct one, now find and click its apiClick
    #                 api_click = item.find_element(By.ID, "apiClick")
    #                 self.assertTrue(api_click.is_displayed(), f"'apiClick' should be visible for {target_text}")
    #                 api_click.click()
    #                 found = True
    #                 break
    #         except Exception as e:
    #             print(f"Skipping an apiItem due to: {e}")

    #     self.assertTrue(found, f"Could not find apiName with text '{target_text}'")
        
    #     # id="operationName" -> text equality "Calculate Drake Equation"
    #     operation_name_el = self.wait.until(EC.presence_of_element_located((By.ID, "operationName")))
    #     self.assertTrue(operation_name_el, "operationName should be present")
    #     self.assertEqual(self.normalize_text(operation_name_el.text), "Calculate Drake Equation",
    #                     "operationName text should equal 'Calculate Drake Equation'")

    #     # id="operationDescription" -> long text equality (normalize whitespace)
    #     expected_operation_description = (
    #         "Calculates the estimated number of civilizations in the galaxy using the Drake Equation. "
    #         "This function takes 7 numeric input parameters: R: the average rate of star formation per year "
    #         "fp: the fraction of stars that have planets ne: the average number of planets that can support life "
    #         "per star fl: the fraction of those planets where life actually develops fi: the fraction of "
    #         "life-bearing planets where intelligent life evolves fc: the fraction of intelligent civilizations "
    #         "that develop detectable communication L: the average duration (in years) such civilizations release signals "
    #         "Returns a JSON object with the estimated number of civilizations (estimated_civilizations) as a float. "
    #         "Where the formula is N = R * fp * ne * fl * fi * fc * L. V4"
    #     )
    #     operation_description_el = self.wait.until(EC.presence_of_element_located((By.ID, "operationDescription")))
    #     self.assertTrue(operation_description_el, "operationDescription should be present")
    #     self.assertEqual(self.normalize_text(operation_description_el.text), self.normalize_text(expected_operation_description),
    #                     "operationDescription should match the expected Drake Equation description")

    #     # id="customNameInput" presence and input capability
    #     custom_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "customNameInput")))
    #     self.assertTrue(custom_name_input.is_displayed(), "customNameInput should be visible")
    #     custom_name_input.clear()
    #     custom_name_input.send_keys("KING_OF_SKILL")
    #     self.assertEqual(custom_name_input.get_attribute("value"), "KING_OF_SKILL", "customNameInput should accept input")

    #     # id="customDescriptionInput" presence and input capability
    #     custom_desc_input = self.wait.until(EC.presence_of_element_located((By.ID, "customDescriptionInput")))
    #     self.assertTrue(custom_desc_input.is_displayed(), "customDescriptionInput should be visible")
    #     custom_desc_input.clear()
    #     custom_desc_input.send_keys("WAAAAAARIO")
    #     self.assertEqual(custom_desc_input.get_attribute("value"), "WAAAAAARIO", "customDescriptionInput should accept input")

    #     # title="toggleButton" button/clickable
    #     toggle_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "toggleButton")))
    #     self.assertTrue(toggle_btn, "toggleButton should be clickable")
    #     # toggle it (click once, optionally click back if you want to restore state)

    #     # id="parameterName" -> check one parameter name equals "R"
    #     parameter_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "parameterName")))
    #     self.assertTrue(parameter_name_elements, "parameterName elements should be present")

    #     found_r = any(self.normalize_text(el.text) == "R" for el in parameter_name_elements)
    #     self.assertTrue(found_r, "At least one parameterName should equal 'R'")

    #     # id="parameterInput" presence of all/input (there may be multiple inputs for parameters)
    #     parameter_inputs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "parameterInput")))
    #     self.assertTrue(parameter_inputs and len(parameter_inputs) > 0, "There should be at least one parameterInput present")
    #     # try sending a sample numeric value to the first parameter input
    #     first_param = parameter_inputs[0]
    #     first_param.clear()
    #     first_param.send_keys("1")
    #     self.assertEqual(first_param.get_attribute("value"), "1", "parameterInput should accept numeric input")

    #     # id="parameterDescription" -> check text equals "Average rate of star formation per year in the galaxy"
    #     parameter_description_el = self.wait.until(EC.presence_of_element_located((By.ID, "parameterDescription")))
    #     self.assertTrue(parameter_description_el, "parameterDescription should be present")
    #     self.assertEqual(self.normalize_text(parameter_description_el.text),
    #                     "Average rate of star formation per year in the galaxy",
    #                     "parameterDescription text should match expected description")

    #     # id="technicalDetails" presence
    #     technical_details_el = self.wait.until(EC.presence_of_element_located((By.ID, "technicalDetails")))
    #     self.assertTrue(technical_details_el.is_displayed(), "technicalDetails should be present and visible")

    #     # id="cancelAddActionButton" clickable
    #     cancel_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "cancelAddActionButton")))
    #     self.assertTrue(cancel_btn, "cancelAddActionButton should be clickable")

    #     # id="addActionButton" clickable
    #     add_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "addActionButton")))
    #     self.assertTrue(add_btn, "addActionButton should be clickable")

    #     # Click cancel to close modal (cleanup)
    #     cancel_btn.click()
    #     time.sleep(1)

    #     invisible = self.wait.until(EC.invisibility_of_element_located((By.ID, "operationName")))
    #     self.assertTrue(invisible, "Window with Action sets is closed")
        
    # ----------------- Test View Action WITHOUT CUSTOM -----------------
    """Test the Presence of all the elements in the Scheduled Tasks Modal"""
    
    def test_view_action_non_custom(self):
        # Extra sleep for extra loading
        time.sleep(3)
        
        add_action_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "addAction")))
        self.assertTrue(add_action_btn, "Add Action Button should be clickable")
        add_action_btn.click()
        time.sleep(3)
        
        # id="apiOperationsSelect" click
        api_operation_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "apiOperationsSelect")))
        self.assertTrue(api_operation_btn, "API Operation Button should be clickable")
        api_operation_btn.click()
        time.sleep(2)
        
        # id="api-dropdown-menu" check presence of
        api_dropdown_menu = self.wait.until(EC.presence_of_element_located((By.ID, "api-dropdown-menu")))
        self.assertTrue(api_dropdown_menu, "API Dropdown Menu should be present")
        time.sleep(1)
        
        # id="toolsSelect" check presence of / can click
        custom_select_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "toolsSelect")))
        self.assertTrue(custom_select_btn, "Agent Tools Select should be clickable in the dropdown menu")
        time.sleep(1)
        
        custom_select_btn.click()
        
        # Find all apiItem elements
        api_items = self.wait.until(EC.presence_of_all_elements_located((By.ID, "apiItem")))
        self.assertTrue(api_items, "Selectable API elements should be visible")

        target_text = "Write File From String"
        found = False

        for item in api_items:
            try:
                # Find the apiName element within this apiItem
                api_name = item.find_element(By.ID, "apiName")
                
                if api_name.text.strip() == target_text:
                    # Found the correct one, now find and click its apiClick
                    api_click = item.find_element(By.ID, "apiClick")
                    self.assertTrue(api_click.is_displayed(), f"'apiClick' should be visible for {target_text}")
                    api_click.click()
                    found = True
                    break
            except Exception as e:
                print(f"Skipping an apiItem due to: {e}")

        self.assertTrue(found, f"Could not find apiName with text '{target_text}'")
        
        # id="operationName" -> text equality "Write File From String"
        operation_name_el = self.wait.until(EC.presence_of_element_located((By.ID, "operationName")))
        self.assertTrue(operation_name_el, "operationName should be present")
        self.assertEqual(self.normalize_text(operation_name_el.text), "Write File From String",
                        "operationName text should equal 'Write File From String'")

        # id="operationDescription" -> long text equality (normalize whitespace)
        expected_operation_description = (
            "Writes string content to a file. Creates a new file or overwrites an existing file with the specified content. Args: file_path: Path where the file should be written content: String content to write to the file mode: File open mode ('w' for write/overwrite, 'a' for append) Returns: Confirmation message of successful write Examples: >>> write_file_from_string('/home/user/notes.txt', 'Hello, world!') 'Content written to /home/user/notes.txt' >>> write_file_from_string('/home/user/log.txt', 'New entry', 'a') 'Content written to /home/user/log.txt'"
        )
        operation_description_el = self.wait.until(EC.presence_of_element_located((By.ID, "operationDescription")))
        self.assertTrue(operation_description_el, "operationDescription should be present")
        self.assertEqual(self.normalize_text(operation_description_el.text), self.normalize_text(expected_operation_description),
                        "operationDescription should match the expected Drake Equation description")

        # id="customNameInput" presence and input capability
        custom_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "customNameInput")))
        self.assertTrue(custom_name_input.is_displayed(), "customNameInput should be visible")
        custom_name_input.clear()
        custom_name_input.send_keys("Dark Souls 2")
        self.assertEqual(custom_name_input.get_attribute("value"), "Dark Souls 2", "customNameInput should accept input")

        # id="customDescriptionInput" presence and input capability
        custom_desc_input = self.wait.until(EC.presence_of_element_located((By.ID, "customDescriptionInput")))
        self.assertTrue(custom_desc_input.is_displayed(), "customDescriptionInput should be visible")
        custom_desc_input.clear()
        custom_desc_input.send_keys("Fire Temple")
        self.assertEqual(custom_desc_input.get_attribute("value"), "Fire Temple", "customDescriptionInput should accept input")

        # title="toggleButton" button/clickable
        toggle_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "toggleButton")))
        self.assertTrue(toggle_btn, "toggleButton should be clickable")
        # toggle it (click once, optionally click back if you want to restore state)

        # id="parameterName" -> check one parameter name equals "File Path"
        parameter_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "parameterName")))
        self.assertTrue(parameter_name_elements, "parameterName elements should be present")

        found_r = any(self.normalize_text(el.text) == "File Path" for el in parameter_name_elements)
        self.assertTrue(found_r, "At least one parameterName should equal 'File Path'")

        # id="parameterInput" presence of all/input (there may be multiple inputs for parameters)
        parameter_inputs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "parameterInput")))
        self.assertTrue(parameter_inputs and len(parameter_inputs) > 0, "There should be at least one parameterInput present")
        # try sending a sample numeric value to the first parameter input
        first_param = parameter_inputs[0]
        first_param.clear()
        first_param.send_keys("temp_environment/text.txt")
        self.assertEqual(first_param.get_attribute("value"), "temp_environment/text.txt", "parameterInput should accept string input")
        
        # id="parameterName" -> check one parameter name equals "Content"
        parameter_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "parameterName")))
        self.assertTrue(parameter_name_elements, "parameterName elements should be present")

        found_r = any(self.normalize_text(el.text) == "Content" for el in parameter_name_elements)
        self.assertTrue(found_r, "At least one parameterName should equal 'Content'")

        # id="parameterInput" presence of all/input (there may be multiple inputs for parameters)
        parameter_inputs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "parameterInput")))
        self.assertTrue(parameter_inputs and len(parameter_inputs) > 0, "There should be at least one parameterInput present")
        # try sending a sample numeric value to the first parameter input
        first_param = parameter_inputs[0]
        first_param.clear()
        first_param.send_keys("Life... Oh whoops... Running in the 90s")
        self.assertEqual(first_param.get_attribute("value"), "Life... Oh whoops... Running in the 90s", "parameterInput should accept string input")

        # id="technicalDetails" presence
        technical_details_el = self.wait.until(EC.presence_of_element_located((By.ID, "technicalDetails")))
        self.assertTrue(technical_details_el.is_displayed(), "technicalDetails should be present and visible")

        # id="cancelAddActionButton" clickable
        cancel_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "cancelAddActionButton")))
        self.assertTrue(cancel_btn, "cancelAddActionButton should be clickable")

        # id="addActionButton" clickable
        add_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "addActionButton")))
        self.assertTrue(add_btn, "addActionButton should be clickable")

        # Click cancel to close modal (cleanup)
        cancel_btn.click()
        time.sleep(1)

        invisible = self.wait.until(EC.invisibility_of_element_located((By.ID, "operationName")))
        self.assertTrue(invisible, "Window with Action sets is closed")
    
    # ----------------- Test Run Action -----------------
    """Test the Presence of all the elements in the Scheduled Tasks Modal"""
    # String Write File
        
if __name__ == "__main__":
    unittest.main(verbosity=2)
