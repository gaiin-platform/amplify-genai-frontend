import unittest
import time
import os
import re
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import UnexpectedAlertPresentException, NoSuchElementException
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import Select
from tests.base_test import BaseTest

class ChatBarMiscTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=False)
        
    def sidebar_press(self):
        time.sleep(1)  # Optional; remove if not strictly necessary

        try:
            # If the collapseSidebar is found and visible, sidebar is already open
            collapse_sidebar = self.driver.find_element(By.ID, "collapseSidebar")
            if collapse_sidebar.is_displayed():
                # Sidebar is open; do nothing
                return
        except:
            # Element not found, which means sidebar is likely closed — expand it
            expand_sidebar_button = self.wait.until(
                EC.presence_of_element_located((By.ID, "expandSidebar"))
            )
            self.assertTrue(expand_sidebar_button.is_displayed(), "Expand Sidebar Button is visible")
            expand_sidebar_button.click()
        
    def click_assistants_tab(self):
        time.sleep(5)
        tab_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        assistants_button = next((btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")), None)
        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")
        assistants_button.click()

        time.sleep(2)
        
    # ----------------- Setup Test Data ------------------  
    def create_assistant(self, assistant_name):
        self.click_assistants_tab()
        assistant_add_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addAssistantButton")))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()
        
        assistant_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantName")))
        self.assertIsNotNone(assistant_name_input, "Assistant Name input should be present")
        assistant_name_input.clear()
        assistant_name_input.send_keys(assistant_name)
        
        assistant_save_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertIsNotNone(assistant_save_button, "Save button should be initialized and clickable")
        assistant_save_button[-1].click()
        
        time.sleep(5)
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "dropName")))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Assistants"), None)
        self.assertIsNotNone(assistant_dropdown_button, "Assistants button should be present")
        
        # Ensure the parent button's title is "Collapse folder" before clicking
        parent_button = assistant_dropdown_button.find_element(By.XPATH, "./ancestor::button")
        button_title = parent_button.get_attribute("title")
        if button_title != "Collapse folder":
            assistant_dropdown_button.click()
        
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptName")))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        assistant_in_list = next((el for el in prompt_name_elements if el.text == assistant_name), None)
        self.assertIsNotNone(assistant_in_list, f"{assistant_name} should be visible in the dropdown")
    
    # ----------------- Test Upload Files -----------------
    """This test ensures that the upolad files button can be hit and that the system-generated 
       file upload window appears. This is only confirmable by viewing."""
    
    def test_upload_files_visible(self):
        # A little more time to load
        time.sleep(3)
    
        self.sidebar_press()
        
        # Find the Select Enabled Features Button
        upload_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "uploadFile")))
        self.assertTrue(upload_files_button.is_displayed(), "Select Upload Files Button element is visible")

        # Click the Upload button
        upload_files_button.click()
        
        time.sleep(3)  # Give time for any UI changes
        
        # Selenium can't detect and/or interact with a system-generated window

    # ----------------- Test Select Assistants -----------------
    """This test ensures that Assistant chat labels can be selected."""
    
    def test_select_assistants(self):
        
        self.sidebar_press()
        self.create_assistant("Ninji")
        
        # A little more time to load
        time.sleep(3)
        
        # Find the Select Assistants Button
        select_assistants_button = self.wait.until(EC.presence_of_element_located((By.ID, "selectAssistants")))
        self.assertTrue(select_assistants_button.is_displayed(), "Select Assistants Button element is visible")

        # Click the assistants button
        select_assistants_button.click()
        
        time.sleep(2)
        
        # Find the standard_conversation Button
        standard_conversation_button = self.wait.until(EC.presence_of_element_located((By.ID, "standardConversation")))
        self.assertTrue(standard_conversation_button.is_displayed(), "Select standard_conversation Button element is visible")

        # Click the standard_conversation button
        standard_conversation_button.click()
        
        time.sleep(2)  
        
        # Locate the <select> dropdown
        select_element = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "select.w-full.cursor-pointer"))
        )
        
        # Use Selenium's Select class to interact with the dropdown
        dropdown = Select(select_element)

        # Select the option by visible text "Ninji"
        dropdown.select_by_visible_text("Ninji")

        time.sleep(2)  # Allow any UI updates

        # Ensure the Assistant Chat Label appears after selection
        assistant_chat_label = self.wait.until(EC.presence_of_element_located(
            (By.ID, "assistantChatLabel")
        ))
        self.assertIsNotNone(assistant_chat_label, "Assistant chat label should appear after selection")
    
    # ----------------- Test Collapse Left Sidebar -----------------
    """This test ensures that the left sidebar can be collapsed"""
    
    def test_collapse_left_sidebar(self):
        
        self.sidebar_press()
        
        # A little more time to load
        time.sleep(3)
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[0].click()
        
        time.sleep(3)  # Give time for any UI changes
        
        # id="tabSelection" is not visible
        tab_selection = self.wait.until(EC.invisibility_of_element_located((By.ID, "tabSelection")))
        self.assertTrue(tab_selection, "tabSelection should not be visible after collapsing sidebar")
        
        self.sidebar_press()

    # ----------------- Test Collapse Right Sidebar -----------------
    """This test ensures that the right sidebar can be collapsed"""
    
    def test_collapse_right_sidebar(self):
        
        self.sidebar_press()
        self.click_assistants_tab()
        
        time.sleep(3)
        
        # Find the Select Collapse Right Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Click the Right Sidebar
        sidebar_collapse_buttons[-1].click()
        
        time.sleep(3)  # Give time for any UI changes
        
        # id="addAssistantButton" is not visible
        add_assistant_selection = self.wait.until(EC.invisibility_of_element_located((By.ID, "addAssistantButton")))
        self.assertTrue(add_assistant_selection, "addAssistantButton should not be visible after collapsing sidebar")
        
        self.sidebar_press()
        

if __name__ == "__main__":
    unittest.main(verbosity=2)