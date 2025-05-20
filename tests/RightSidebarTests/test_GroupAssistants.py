import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import UnexpectedAlertPresentException
from tests.base_test import BaseTest
from selenium.webdriver.common.keys import Keys


class GroupAssistantsTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------ 

    def open_test_group_assistants(self):

        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "dropName")))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        team_assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Teams Assistant"), None)
        self.assertIsNotNone(team_assistant_dropdown_button, "Team Assistant button should be present")
        team_assistant_dropdown_button.click()
        time.sleep(2)
    
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptName")))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        happy_amplify = next((el for el in prompt_name_elements if el.text == "Happy Amplify"), None,)
        self.assertIsNotNone(happy_amplify, "Happy Amplify should be visible in the dropdown",)
        happy_amplify_button = happy_amplify.find_element(By.XPATH, "./ancestor::button")
        button_id = happy_amplify_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")

        action = ActionChains(self.driver)
        action.move_to_element(happy_amplify_button).perform()
        time.sleep(2)

        edit_button = self.wait.until(EC.element_to_be_clickable((By.ID, "editTemplate")))
        self.assertIsNotNone(edit_button, "Edit button should be initialized and clicked")
        edit_button.click()
        
        time.sleep(5)
        
    
    # ----------------- Test Features of Group Modal Assistant -----------------
    """Test that Features of a Group Modal Assistant are visible"""
    
    def test_group_modal_assistant_features(self):
        
        self.open_test_group_assistants()
        
        time.sleep(5) # Extra Look
        
        # Check if "Create Assistant" button is clickable
        create_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "createAssistantButton"))
        )
        self.assertIsNotNone(create_button, "Create Assistant button should be clickable")

        # Check if "Delete Assistant" button is clickable
        delete_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "deleteAssistantButton"))
        )
        self.assertIsNotNone(delete_button, "Delete Assistant button should be clickable")

        # Check presence of all sub-tabs
        sub_tabs = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "subTabs"))
        )
        self.assertTrue(len(sub_tabs) > 0, "SubTabs should be present")

        # Interact with the "publishAssistant" toggle
        publish_toggle = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'label[for="publishAssistant"]'))
        )
        publish_toggle.click()
        time.sleep(1)
        publish_toggle.click()

        # Interact with the "enforceModel" toggle
        enforce_toggle = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'label[for="enforceModel"]'))
        )
        enforce_toggle.click()
        time.sleep(1)
        enforce_toggle.click()

        # Check presence of the model selector
        model_selector = self.wait.until(
            EC.presence_of_element_located((By.ID, "modelSelect"))
        )
        self.assertIsNotNone(model_selector, "Model selector should be present")

        # Interact with the "trackConversations" toggle
        track_toggle = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'label[for="trackConversations"]'))
        )
        track_toggle.click()
        time.sleep(1)
        track_toggle.click()
        time.sleep(3)
        
        # Check for presence of all 4 checkboxes with id="typeCheckBox"
        type_checkboxes = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "typeCheckBox"))
        )
        self.assertEqual(len(type_checkboxes), 4, "There should be exactly 4 type checkboxes")

        # Verify first three are checked
        for i in range(3):
            is_checked = type_checkboxes[i].is_selected()
            self.assertTrue(is_checked, f"Type checkbox {i+1} should be checked")

        # Verify the fourth is NOT checked
        is_checked = type_checkboxes[3].is_selected()
        self.assertFalse(is_checked, "Type checkbox 4 should NOT be checked")
        
        # Clear the textarea and input new message
        user_group_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userGroupSelectionMessage"))
        )
        user_group_message.clear()
        time.sleep(1)
        user_group_message.send_keys("Happy, Happy, Happy")

        # Find all elements with id="expandComponent"
        expand_components = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "expandComponent"))
        )

        # Loop through each expandComponent, find its child <span>, and match the text
        for component in expand_components:
            try:
                span = component.find_element(By.TAG_NAME, "span")
                if span.text.strip() == "Manage Selected Group Type Data":
                    component.click()
                    break
            except Exception as e:
                continue
        
        time.sleep(3)
        
        # These values come from the earlier section of the test
        type_checkboxes = ["Type I", "Type II", "Type III"]

        for type_name in type_checkboxes:
            content_id = f"{type_name} Content"
            content_element = self.wait.until(
                EC.presence_of_element_located((By.ID, content_id))
            )
            self.assertIsNotNone(content_element, f"{content_id} should be present.")

        disable_checks = {
            "Type I": False,
            "Type II": True,
            "Type III": False,
        }

        for type_name, should_be_checked in disable_checks.items():
            checkbox = self.wait.until(
                EC.presence_of_element_located((By.ID, f"{type_name} DisableMessage"))
            )
            is_checked = checkbox.get_attribute("checked") is not None
            self.assertEqual(
                is_checked,
                should_be_checked,
                f"{type_name} DisableMessage checked state mismatch",
            )

        type3_disable = self.wait.until(
            EC.element_to_be_clickable((By.ID, "Type III DisableMessage"))
        )
        type3_disable.click()
        time.sleep(1)

        # After clicking, verify the expected instruction IDs
        self.wait.until(EC.presence_of_element_located((By.ID, "enabledInstructionType I")))
        self.wait.until(EC.presence_of_element_located((By.ID, "disabledInstructionType II")))
        self.wait.until(EC.presence_of_element_located((By.ID, "disabledInstructionType III")))

        # Click again to uncheck
        type3_disable.click()
        time.sleep(1)

        # Final instruction ID verification
        self.wait.until(EC.presence_of_element_located((By.ID, "enabledInstructionType I")))
        self.wait.until(EC.presence_of_element_located((By.ID, "disabledInstructionType II")))
        self.wait.until(EC.presence_of_element_located((By.ID, "enabledInstructionType III")))
        
        type3_input = self.wait.until(EC.presence_of_element_located((By.ID, "enabledInstructionType III")))
        type3_input.clear()
        time.sleep(1)
        type3_input.send_keys("When there's trouble you know who to call... Teen Titans")
        time.sleep(2)
        
        self.wait.until(EC.presence_of_element_located((By.ID, "__attachFile_admin_Type I_TeamsAssistant_178d2947-a0af-4cba-9164-6f23bc72ca34_astg/41e4fcca-3fd6-4100-84a3-a71983d0b125")))
        self.wait.until(EC.invisibility_of_element_located((By.ID, "__attachFile_admin_Type II_TeamsAssistant_178d2947-a0af-4cba-9164-6f23bc72ca34_astg/41e4fcca-3fd6-4100-84a3-a71983d0b125")))
        self.wait.until(EC.presence_of_element_located((By.ID, "__attachFile_admin_Type III_TeamsAssistant_178d2947-a0af-4cba-9164-6f23bc72ca34_astg/41e4fcca-3fd6-4100-84a3-a71983d0b125")))

        enter_website_url = self.wait.until(EC.presence_of_element_located((By.ID, "enterWebsiteUrl")))
        enter_website_url.clear()
        time.sleep(1)
        enter_website_url.send_keys("RobinStarfireRavenCyborgBeastBoy.com")
        time.sleep(2)
        
        self.wait.until(EC.presence_of_element_located((By.ID, "addUrlButton")))
        
        site_map_check = self.wait.until(
            EC.element_to_be_clickable((By.ID, "siteMapCheck"))
        )
        site_map_check.click()
        time.sleep(1)
        site_map_check.click()
        time.sleep(2)
        
        # Find all elements with id="expandComponent"
        expand_components = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "expandComponent"))
        )

        # Loop through each expandComponent, find its child <span>, and match the text
        for component in expand_components:
            try:
                span = component.find_element(By.TAG_NAME, "span")
                if span.text.strip() == "Advanced":
                    component.click()
                    break
            except Exception as e:
                continue
        
        time.sleep(3)
        
        self.wait.until(EC.presence_of_element_located((By.ID, "addWorkflowTemplate")))
        self.wait.until(EC.element_to_be_clickable((By.ID, "addWorkflowButton")))
        
        # Interact with the "emailEvents" toggle
        email_events = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'label[for="emailEvents"]'))
        )
        email_events.click()
        time.sleep(1)
        email_events.click()
        time.sleep(3)
        
    # ----------------- Test Manage Custom APIs of Group Modal Assistant -----------------
    """Test that Features of the Manage Custom APIs in the Group Modal Assistant"""
        
    def test_group_modal_assistant_manage_custom_api_features(self):
        
        self.open_test_group_assistants()
        
        time.sleep(5) # Extra Look
        
        # Find all elements with id="expandComponent"
        expand_components = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "expandComponent"))
        )

        # Loop through each expandComponent, find its child <span>, and match the text
        for component in expand_components:
            try:
                span = component.find_element(By.TAG_NAME, "span")
                if span.text.strip() == "Advanced":
                    component.click()
                    break
            except Exception as e:
                continue
        
        time.sleep(3)
        
        manage_agent_tools = self.wait.until(EC.presence_of_element_located((By.ID, "ManageCustomAPIs")))
        manage_agent_tools.click()
        
        time.sleep(2)
        
        api_names = []
        index = 0

        while True:
            try:
                api_item = self.wait.until(
                    EC.presence_of_element_located((By.ID, f"api-item {index}"))
                )
                name_span = api_item.find_element(By.CSS_SELECTOR, "span.mt-\\[1px\\].font-bold")
                api_names.append(name_span.text.strip())
                index += 1
            except:
                break
        
        expected_api_names = ['Calculate Total23', 'Fetch Url Content', 'Google Search Results', 'Google Fetch Sheet Row Count', 'Store File To Bucket', 'Test', 'Web Scrapper']
        
        self.assertEqual(api_names, expected_api_names, "The extracted and expected lists are the same")
        
        time.sleep(2)
        
        search_bars = self.wait.until(EC.presence_of_all_elements_located((By.ID, "SearchBar")))
        self.assertTrue(search_bars, "Search Bar elements should be initialized")
        
        the_search_bar = search_bars[-1]
        
        the_search_bar.send_keys("Test")
        
        time.sleep(2)
        
        search_api_names = []
        index = 0

        while True:
            try:
                search_api_item = self.wait.until(
                    EC.presence_of_element_located((By.ID, f"api-item {index}"))
                )
                name_span = search_api_item.find_element(By.CSS_SELECTOR, "span.mt-\\[1px\\].font-bold")
                search_api_names.append(name_span.text.strip())
                index += 1
            except:
                break
        
        expected_api_names = ['Test']
        
        self.assertEqual(search_api_names, expected_api_names, "The extracted and expected lists are the same")
        
        time.sleep(2)
        
        name_tag_toggle = self.wait.until(EC.presence_of_all_elements_located((By.ID, "nameTagToggle")))
        self.assertIsNotNone(name_tag_toggle, "Name Tag Toggle Buttons are visible should be present")
        name_tag_toggle[-1].click()
        
        time.sleep(2)
        
        search_bars = self.wait.until(EC.presence_of_all_elements_located((By.ID, "SearchBar")))
        self.assertTrue(search_bars, "Search Bar elements should be initialized")
        
        the_search_bar = search_bars[-1]
        
        the_search_bar.clear()
        
        time.sleep(2)
        
        the_search_bar.send_keys("query_results")
        
        time.sleep(2)
        
        search_api_names = []
        index = 0

        while True:
            try:
                search_api_item = self.wait.until(
                    EC.presence_of_element_located((By.ID, f"api-item {index}"))
                )
                name_span = search_api_item.find_element(By.CSS_SELECTOR, "span.mt-\\[1px\\].font-bold")
                search_api_names.append(name_span.text.strip())
                index += 1
            except:
                break
        
        expected_api_names = ['Google Search Results']
        
        self.assertEqual(search_api_names, expected_api_names, "The extracted and expected lists are the same")
        
        time.sleep(2)
        
        search_bars = self.wait.until(EC.presence_of_all_elements_located((By.ID, "SearchBar")))
        self.assertTrue(search_bars, "Search Bar elements should be initialized")
        
        the_search_bar = search_bars[-1]
        
        the_search_bar.clear()
        
        time.sleep(2)
        
        the_search_bar.send_keys("huh")
        
        time.sleep(2)
        
        search_api_names = []
        index = 0

        while True:
            try:
                search_api_item = self.wait.until(
                    EC.presence_of_element_located((By.ID, f"api-item {index}"))
                )
                name_span = search_api_item.find_element(By.CSS_SELECTOR, "span.mt-\\[1px\\].font-bold")
                search_api_names.append(name_span.text.strip())
                index += 1
            except:
                break
        
        expected_api_names = [] # No elements should be found
        
        self.assertEqual(search_api_names, expected_api_names, "The extracted and expected lists are the same")
        
    # ----------------- Test Manage Internal APIs of Group Modal Assistant -----------------
    """Test that Features of the Manage Internal APIs in the Group Modal Assistant"""
        
    def test_group_modal_assistant_manage_internal_api_features(self):
        
        self.open_test_group_assistants()
        
        time.sleep(5) # Extra Look
        
        # Find all elements with id="expandComponent"
        expand_components = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "expandComponent"))
        )

        # Loop through each expandComponent, find its child <span>, and match the text
        for component in expand_components:
            try:
                span = component.find_element(By.TAG_NAME, "span")
                if span.text.strip() == "Advanced":
                    component.click()
                    break
            except Exception as e:
                continue
        
        time.sleep(3)
        
        manage_agent_tools = self.wait.until(EC.presence_of_element_located((By.ID, "ManageInternalAPIs")))
        manage_agent_tools.click()
        
        time.sleep(2)
        
        api_names = []
        index = 0

        while True:
            try:
                api_item = self.wait.until(
                    EC.presence_of_element_located((By.ID, f"api-item {index}"))
                )
                name_span = api_item.find_element(By.CSS_SELECTOR, "span.mt-\\[1px\\].font-bold")
                api_names.append(name_span.text.strip())
                index += 1
            except:
                break
        
        expected_api_names = ['Get User Accounts', 'Google Get Spreadsheet Rows', 'Google Get Google Sheets Info', 'Google Get Sheet Names', 'Google Insert Rows', 'Google Delete Rows', 
                              'Google Update Rows', 'Google Create Spreadsheet', 'Google Duplicate Sheet', 'Google Rename Sheet', 'Google Clear Range', 'Google Apply Formatting', 'Google Add Chart', 
                              'Google Get Cell Formulas', 'Google Find Replace', 'Google Sort Range', 'Google Apply Conditional Formatting', 'Google Execute Query', 'Google Create New Document', 
                              'Google Get Document Contents', 'Google Insert Text', 'Google Append Text', 'Google Replace Text', 'Google Create Document Outline', 'Google Export Document', 'Google Share Document', 
                              'Google Find Text Indices', 'Google Get Events Between Dates', 'Google Create Event', 'Google Update Event', 'Google Delete Event', 'Google Get Event Details', 'Google Get Events For Date', 
                              'Google Get Free Time Slots', 'Google Check Event Conflicts', 'Google List Files', 'Google Search Files', 'Google Get File Metadata', 'Google Get File Content', 'Google Create File', 
                              'Google Get Download Link', 'Google Create Shared Link', 'Google Share File', 'Google Convert File', 'Google List Folders', 'Google Move Item', 'Google Copy Item', 'Google Rename Item', 
                              'Google Get File Revisions', 'Google Create Folder', 'Google Delete Item Permanently', 'Google Get Root Folder Ids', 'Google Create Form', 'Google Get Form Details', 'Google Add Question', 
                              'Google Update Question', 'Google Delete Question', 'Google Get Responses', 'Google Get Response', 'Google Set Form Settings', 'Google Get Form Link', 'Google Update Form Info', 'Google List User Forms', 
                              'Google Compose And Send Email', 'Google Compose Email Draft', 'Google Get Messages From Date', 'Google Get Recent Messages', 'Google Search Messages', 'Google Get Attachment Links', 
                              'Google Get Attachment Content', 'Google Create Filter', 'Google Create Label', 'Google Create Auto Filter Label Rule', 'Google Get Message Details', 'Google Search Contacts', 'Google Get Contact Details', 
                              'Google Create Contact', 'Google Update Contact', 'Google Delete Contact', 'Google List Contact Groups', 'Google Create Contact Group', 'Google Update Contact Group', 'Google Delete Contact Group', 
                              'Google Add Contacts To Group', 'Google Remove Contacts From Group', 'Google List Calendars', 'Google Create Calendar', 'Google Delete Calendar', 'Google Update Calendar Permissions', 'Google Create Recurring Event', 
                              'Google Add Event Reminders', 'Google Get Calendar Details', 'Google Update Calendar', 'Google Send Draft Email', 'List User Integrations', 'Microsoft List Drive Items', 'Microsoft Upload File', 
                              'Microsoft Download File', 'Microsoft Delete Item', 'Microsoft Get Drive Item', 'Microsoft Create Folder', 'Microsoft Update Drive Item', 'Microsoft Copy Drive Item', 'Microsoft Move Drive Item', 
                              'Microsoft Create Sharing Link', 'Microsoft Invite To Drive Item', 'Microsoft List Worksheets', 'Microsoft List Tables', 'Microsoft Add Row To Table', 'Microsoft Read Range', 'Microsoft Update Range', 
                              'Microsoft List Messages', 'Microsoft Get Message Details', 'Microsoft Send Mail', 'Microsoft Delete Message', 'Microsoft Get Attachments', 'Microsoft List Sites', 'Microsoft Get Site By Path', 'Microsoft List Site Lists', 
                              'Microsoft Get List Items', 'Microsoft Create List Item', 'Microsoft Update List Item', 'Microsoft Delete List Item', 'Microsoft List Notebooks', 'Microsoft List Sections In Notebook', 'Microsoft List Pages In Section', 
                              'Microsoft Create Page In Section', 'Microsoft Get Page Content', 'Microsoft Create Page With Image And Attachment', 'Microsoft List Contacts', 'Microsoft Get Contact Details', 'Microsoft Create Contact', 'Microsoft Delete Contact', 
                              'Microsoft Create Event', 'Microsoft Update Event', 'Microsoft Delete Event', 'Microsoft Get Event Details', 'Microsoft Get Events Between Dates', 'Microsoft Update Message', 'Microsoft Create Draft', 'Microsoft Send Draft', 
                              'Microsoft Reply To Message', 'Microsoft Reply All Message', 'Microsoft Forward Message', 'Microsoft Move Message', 'Microsoft Get Folder Details', 'Microsoft Add Attachment', 'Microsoft Delete Attachment', 'Microsoft Search Messages', 
                              'Microsoft List Calendar Events', 'Microsoft Create Calendar', 'Microsoft Delete Calendar', 'Microsoft Respond To Event', 'Microsoft Find Meeting Times', 'Microsoft Create Recurring Event', 'Microsoft Update Recurring Event', 
                              'Microsoft Calendar Add Attachment', 'Microsoft Get Event Attachments', 'Microsoft Delete Event Attachment', 'Microsoft Get Calendar Permissions', 'Microsoft Share Calendar', 'Microsoft Remove Calendar Sharing', 
                              'Microsoft Get Worksheet', 'Microsoft Create Worksheet', 'Microsoft Delete Worksheet', 'Microsoft Create Table Excel', 'Microsoft Delete Table', 'Microsoft Get Table Range', 'Microsoft List Charts', 'Microsoft Get Chart', 
                              'Microsoft Create Chart', 'Microsoft Delete Chart', 'Microsoft Add Comment', 'Microsoft Get Document Statistics', 'Microsoft Search Document', 'Microsoft Apply Formatting', 'Microsoft Get Document Sections', 'Microsoft Insert Section', 
                              'Microsoft Replace Text', 'Microsoft Create Table Word', 'Microsoft Update Table Cell', 'Microsoft Create List', 'Microsoft Insert Page Break', 'Microsoft Set Header Footer', 'Microsoft Insert Image', 'Microsoft Get Document Versions', 
                              'Microsoft Restore Version', 'Microsoft Delete Document', 'Microsoft List Documents', 'Microsoft Share Document', 'Microsoft Get Document Permissions', 'Microsoft Remove Permission', 'Microsoft Get Document Content', 
                              'Microsoft Update Document Content', 'Microsoft Create Document', 'Microsoft List Calendars', 'Microsoft List Folders', 'Microsoft Check Event Conflicts']
        
        self.assertEqual(api_names, expected_api_names, "The extracted and expected lists are the same")
        
        time.sleep(2)
        
        search_bars = self.wait.until(EC.presence_of_all_elements_located((By.ID, "SearchBar")))
        self.assertTrue(search_bars, "Search Bar elements should be initialized")
        
        the_search_bar = search_bars[-1]
        
        the_search_bar.send_keys("integration")
        
        time.sleep(2)
        
        search_api_names = []
        index = 0

        while True:
            try:
                search_api_item = self.wait.until(
                    EC.presence_of_element_located((By.ID, f"api-item {index}"))
                )
                name_span = search_api_item.find_element(By.CSS_SELECTOR, "span.mt-\\[1px\\].font-bold")
                search_api_names.append(name_span.text.strip())
                index += 1
            except:
                break
        
        expected_api_names = ['List User Integrations']
        
        self.assertEqual(search_api_names, expected_api_names, "The extracted and expected lists are the same")
        
        time.sleep(2)
        
        name_tag_toggle = self.wait.until(EC.presence_of_all_elements_located((By.ID, "nameTagToggle")))
        self.assertIsNotNone(name_tag_toggle, "Name Tag Toggle Buttons are visible should be present")
        name_tag_toggle[-1].click()
        
        time.sleep(2)
        
        search_bars = self.wait.until(EC.presence_of_all_elements_located((By.ID, "SearchBar")))
        self.assertTrue(search_bars, "Search Bar elements should be initialized")
        
        the_search_bar = search_bars[-1]
        
        the_search_bar.clear()
        
        time.sleep(2)
        
        the_search_bar.send_keys("google_drive")
        
        time.sleep(2)
        
        search_api_names = []
        index = 0

        while True:
            try:
                search_api_item = self.wait.until(
                    EC.presence_of_element_located((By.ID, f"api-item {index}"))
                )
                name_span = search_api_item.find_element(By.CSS_SELECTOR, "span.mt-\\[1px\\].font-bold")
                search_api_names.append(name_span.text.strip())
                index += 1
            except:
                break
        
        print(search_api_names)
        expected_api_names = ['Google List Files', 'Google Search Files', 'Google Get File Metadata', 'Google Get File Content', 'Google Create File', 'Google Get Download Link', 'Google Create Shared Link', 'Google Share File', 'Google Convert File', 'Google List Folders', 'Google Move Item', 'Google Copy Item', 'Google Rename Item', 'Google Get File Revisions', 'Google Create Folder', 'Google Delete Item Permanently', 'Google Get Root Folder Ids']
        
        self.assertEqual(search_api_names, expected_api_names, "The extracted and expected lists are the same")
        
        time.sleep(2)
        
        search_bars = self.wait.until(EC.presence_of_all_elements_located((By.ID, "SearchBar")))
        self.assertTrue(search_bars, "Search Bar elements should be initialized")
        
        the_search_bar = search_bars[-1]
        
        the_search_bar.clear()
        
        time.sleep(2)
        
        the_search_bar.send_keys("huh_huh")
        
        time.sleep(2)
        
        search_api_names = []
        index = 0

        while True:
            try:
                search_api_item = self.wait.until(
                    EC.presence_of_element_located((By.ID, f"api-item {index}"))
                )
                name_span = search_api_item.find_element(By.CSS_SELECTOR, "span.mt-\\[1px\\].font-bold")
                search_api_names.append(name_span.text.strip())
                index += 1
            except:
                break
        
        expected_api_names = [] # No elements should be found
        
        self.assertEqual(search_api_names, expected_api_names, "The extracted and expected lists are the same")
        
    # ----------------- Test Manage External APIs of Group Modal Assistant -----------------
    """Test that Features of the Manage External APIs in the Group Modal Assistant"""
        
    def test_group_modal_assistant_manage_external_api_features(self):
        
        self.open_test_group_assistants()
        
        time.sleep(5) # Extra Look
        
        # Find all elements with id="expandComponent"
        expand_components = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "expandComponent"))
        )

        # Loop through each expandComponent, find its child <span>, and match the text
        for component in expand_components:
            try:
                span = component.find_element(By.TAG_NAME, "span")
                if span.text.strip() == "Advanced":
                    component.click()
                    break
            except Exception as e:
                continue
        
        time.sleep(3)
        
        manage_agent_tools = self.wait.until(EC.presence_of_element_located((By.ID, "ManageExternalAPIs")))
        manage_agent_tools.click()
        
        time.sleep(2)
        
        # id="manageAPIandToolsButtons"
        add_external_api = self.wait.until(EC.presence_of_element_located((By.ID, "manageAPIandToolsButtons")))
        add_external_api.click()
        
        time.sleep(2)
        
        # Find all elements with id="expandComponent"
        expand_components = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "expandComponent"))
        )

        # Loop through each expandComponent, find its child <span>, and match the text
        for component in expand_components:
            try:
                span = component.find_element(By.TAG_NAME, "span")
                if span.text.strip() == "Manage API ":
                    component.click()
                    break
            except Exception as e:
                continue
        
        time.sleep(3)
        
        # id="nameAPI" presence_of_element, .clear, .send_keys("Natsu")
        name_input = self.wait.until(EC.presence_of_element_located((By.ID, "nameAPI")))
        name_input.clear()
        time.sleep(1)
        name_input.send_keys("Natsu")
        time.sleep(2)
        
        # id="selectRequestType" 
        select_request_type_elem = self.wait.until(EC.presence_of_element_located((By.ID, "selectRequestType")))
        self.assertIsNotNone(select_request_type_elem, "Select Request Type Selection Menu is visible")

        # id="urlAPI" presence_of_element, .clear, .send_keys("fire_dragon_magic")
        url_input = self.wait.until(EC.presence_of_element_located((By.ID, "urlAPI")))
        url_input.clear()
        time.sleep(1)
        url_input.send_keys("fire_dragon_magic")
        time.sleep(2)

        # id="addParametersButton" presence_of_element, .click()
        add_param_btn = self.wait.until(EC.presence_of_element_located((By.ID, "addParametersButton")))
        add_param_btn.click()
        time.sleep(2)

        # id="addedParameterName" presence_of_element, .clear, time.sleep(1), .send_keys("Lightening")
        param_name = self.wait.until(EC.presence_of_element_located((By.ID, "addedParameterName")))
        param_name.clear()
        time.sleep(1)
        param_name.send_keys("Lightening")
        time.sleep(2)

        # id="addedParameterDescription" presence_of_element, .clear, time.sleep(1), .send_keys("Laxus Lightening Absorbed")
        param_desc = self.wait.until(EC.presence_of_element_located((By.ID, "addedParameterDescription")))
        param_desc.clear()
        time.sleep(1)
        param_desc.send_keys("Laxus Lightening Absorbed")
        time.sleep(2)

        # id="removeParameter" element_to_be_clickable
        remove_param = self.wait.until(EC.element_to_be_clickable((By.ID, "removeParameter")))
        remove_param.click()
        time.sleep(2)

        # id="addHeadersButton" presence_of_element, .click()
        add_header_btn = self.wait.until(EC.presence_of_element_located((By.ID, "addHeadersButton")))
        add_header_btn.click()
        time.sleep(2)

        # id="headerKey" presence_of_element, .clear, time.sleep(1), .send_keys("Dragon Breath")
        header_key = self.wait.until(EC.presence_of_element_located((By.ID, "headerKey")))
        header_key.clear()
        time.sleep(1)
        header_key.send_keys("Dragon Breath")
        time.sleep(2)

        # id="headerValue" presence_of_element, .clear, time.sleep(1), .send_keys("That's a lot of damage")
        header_value = self.wait.until(EC.presence_of_element_located((By.ID, "headerValue")))
        header_value.clear()
        time.sleep(1)
        header_value.send_keys("That's a lot of damage")
        time.sleep(2)

        # id="headersRemove" element_to_be_clickable
        remove_header = self.wait.until(EC.element_to_be_clickable((By.ID, "headersRemove")))
        remove_header.click()
        time.sleep(2)

        # id="bodyJSONInput" presence_of_element, .clear, time.sleep(1), .send_keys("{cool cool}")
        json_input = self.wait.until(EC.presence_of_element_located((By.ID, "bodyJSONInput")))
        json_input.clear()
        time.sleep(1)
        json_input.send_keys("{cool cool}")
        time.sleep(2)

        # id="formatJSONAdd" element_to_be_clickable
        format_json_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "formatJSONAdd")))
        format_json_btn.click()
        time.sleep(2)

        # id="authenticationSelect" presence_of_element
        self.wait.until(EC.presence_of_element_located((By.ID, "authenticationSelect")))
        time.sleep(2)

        # id="descriptionAPI" presence_of_element, .clear, time.sleep(1), .send_keys("Happy the Blue Cat")
        desc_api = self.wait.until(EC.presence_of_element_located((By.ID, "descriptionAPI")))
        desc_api.clear()
        time.sleep(1)
        desc_api.send_keys("Happy the Blue Cat")
        time.sleep(2)

        # id="testAPI" element_to_be_clickable, .click()
        test_api_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "testAPI")))
        test_api_btn.click()
        time.sleep(10)

        # id="apiResponse" presence_of_element
        self.wait.until(EC.presence_of_element_located((By.ID, "apiResponse")))
        time.sleep(2)

        # id="removeAPI" element_to_be_clickable
        remove_api_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "removeAPI")))
        remove_api_btn.click()
        
        time.sleep(5)
        
    # ******************* Test Depracated for time being, no Manage Agent Tools visible *******************
        
    # # ----------------- Test Manage Agent Tools of Group Modal Assistant -----------------
    # """Test that Features of the Manage Agent Tools in the Group Modal Assistant"""
        
    # def test_group_modal_assistant_manage_agent_tools_features(self):
        
    #     self.open_test_group_assistants()
        
    #     time.sleep(5) # Extra Look
        
    #     # Find all elements with id="expandComponent"
    #     expand_components = self.wait.until(
    #         EC.presence_of_all_elements_located((By.ID, "expandComponent"))
    #     )

    #     # Loop through each expandComponent, find its child <span>, and match the text
    #     for component in expand_components:
    #         try:
    #             span = component.find_element(By.TAG_NAME, "span")
    #             if span.text.strip() == "Advanced":
    #                 component.click()
    #                 break
    #         except Exception as e:
    #             continue
        
    #     time.sleep(3)
        
    #     manage_agent_tools = self.wait.until(EC.presence_of_element_located((By.ID, "ManageAgentTools")))
    #     manage_agent_tools.click()
        
    #     time.sleep(2)
        
    #     tool_names = []
    #     index = 0

    #     while True:
    #         try:
    #             tool_item = self.wait.until(
    #                 EC.presence_of_element_located((By.ID, f"tool-item {index}"))
    #             )
    #             name_span = tool_item.find_element(By.CSS_SELECTOR, "span.mt-\\[1px\\].font-bold")
    #             tool_names.append(name_span.text.strip())
    #             index += 1
    #         except:
    #             break

    #     expected_tool_names = ['Get Current Directory', 'Get Writeable Directory', 'List Files In Directory', 'Write File From String', 'Read File', 'Read File Partial', 
    #                            'Search Files Recursive', 'Get Directory Structure', 'Copy File', 'Move File', 'Rename File', 'Delete File', 'Zip Files', 'Unzip Files', 
    #                            'Search Files', 'Terminate', 'Write Long Content', 'Get Installed Python Modules', 'Exec Code', 'Send Http Request', 'Get Web Page Text', 
    #                            'Prompt Llm With Messages', 'Qa Check', 'Prompt Llm', 'Prompt Llm With Info', 'Prompt Llm For Json', 'Prompt Expert', 'Create Plan', 'Determine Progress', 
    #                            'Choose Route', 'Think', 'Call Api']
        
    #     self.assertEqual(tool_names, expected_tool_names, "The extracted and expected lists are the same")
        
    #     time.sleep(2)
        
    #     search_bars = self.wait.until(EC.presence_of_all_elements_located((By.ID, "SearchBar")))
    #     self.assertTrue(search_bars, "Search Bar elements should be initialized")
        
    #     the_search_bar = search_bars[-1]
        
    #     the_search_bar.send_keys("unzip files")
        
    #     time.sleep(2)
        
    #     search_tool_names = []
    #     index = 0

    #     while True:
    #         try:
    #             tool_item = self.wait.until(
    #                 EC.presence_of_element_located((By.ID, f"tool-item {index}"))
    #             )
    #             name_span = tool_item.find_element(By.CSS_SELECTOR, "span.mt-\\[1px\\].font-bold")
    #             search_tool_names.append(name_span.text.strip())
    #             index += 1
    #         except:
    #             break
        
    #     expected_tool_names = ['Unzip Files']
        
    #     self.assertEqual(search_tool_names, expected_tool_names, "The extracted and expected lists are the same")
        
    #     time.sleep(2)
        
    #     name_tag_toggle = self.wait.until(EC.presence_of_all_elements_located((By.ID, "nameTagToggle")))
    #     self.assertIsNotNone(name_tag_toggle, "Name Tag Toggle Buttons are visible should be present")
    #     name_tag_toggle[-1].click()
        
    #     time.sleep(2)
        
    #     search_bars = self.wait.until(EC.presence_of_all_elements_located((By.ID, "SearchBar")))
    #     self.assertTrue(search_bars, "Search Bar elements should be initialized")
        
    #     the_search_bar = search_bars[-1]
        
    #     the_search_bar.clear()
        
    #     time.sleep(2)
        
    #     the_search_bar.send_keys("ops")
        
    #     time.sleep(2)
        
    #     search_tool_names = []
    #     index = 0

    #     while True:
    #         try:
    #             tool_item = self.wait.until(
    #                 EC.presence_of_element_located((By.ID, f"tool-item {index}"))
    #             )
    #             name_span = tool_item.find_element(By.CSS_SELECTOR, "span.mt-\\[1px\\].font-bold")
    #             search_tool_names.append(name_span.text.strip())
    #             index += 1
    #         except:
    #             break
        
    #     expected_tool_names = ['Call Api']
        
    #     self.assertEqual(search_tool_names, expected_tool_names, "The extracted and expected lists are the same")
        
    #     time.sleep(2)
        
    #     search_bars = self.wait.until(EC.presence_of_all_elements_located((By.ID, "SearchBar")))
    #     self.assertTrue(search_bars, "Search Bar elements should be initialized")
        
    #     the_search_bar = search_bars[-1]
        
    #     the_search_bar.clear()
        
    #     time.sleep(2)
        
    #     the_search_bar.send_keys("huh")
        
    #     time.sleep(2)
        
    #     search_tool_names = []
    #     index = 0

    #     while True:
    #         try:
    #             tool_item = self.wait.until(
    #                 EC.presence_of_element_located((By.ID, f"tool-item {index}"))
    #             )
    #             name_span = tool_item.find_element(By.CSS_SELECTOR, "span.mt-\\[1px\\].font-bold")
    #             search_tool_names.append(name_span.text.strip())
    #             index += 1
    #         except:
    #             break
        
    #     expected_tool_names = []
        
    #     self.assertEqual(search_tool_names, expected_tool_names, "The extracted and expected lists are the same")
        
    # ----------------- Test Create Assistant to add to Teams Assistant -----------------
    """Test that Features of the Manage Agent Tools in the Group Modal Assistant"""
        
    def test_group_modal_create_assistant(self):
        
        self.open_test_group_assistants()
        
        time.sleep(5) # Extra Look
        
        create_assistant = self.wait.until(EC.element_to_be_clickable((By.ID, "createAssistantButton")))
        create_assistant.click()
        
        time.sleep(2)
        
        type_checkboxes = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "typeCheckBox"))
        )
        self.assertEqual(len(type_checkboxes), 4, "There should be exactly 4 type checkboxes")
        
        type_checkboxes[0].click()
        time.sleep(1)
        type_checkboxes[1].click()
        time.sleep(1)
        
        # Clear the textarea and input new message
        user_group_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userGroupSelectionMessage"))
        )
        user_group_message.clear()
        time.sleep(1)
        user_group_message.send_keys("Type 1 Torbek or Type 2 Torbek")
        
        assistant_name = self.wait.until(EC.presence_of_element_located((By.ID, "assistantName")))
        assistant_name.clear()
        time.sleep(1)
        assistant_name.send_keys("Torbek")
        time.sleep(2)
        
        save_button = self.wait.until(EC.element_to_be_clickable((By.ID, "saveButton")))
        save_button.click()
        time.sleep(10)
        
        save_button = self.wait.until(EC.element_to_be_clickable((By.ID, "saveButton")))
        save_button.click()
        time.sleep(10)
        
        close_button = self.wait.until(EC.element_to_be_clickable((By.ID, "closeModal")))
        close_button.click()
        time.sleep(10)
        
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "dropName")))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        team_assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Teams Assistant"), None)
        self.assertIsNotNone(team_assistant_dropdown_button, "Team Assistant button should be present")
        team_assistant_dropdown_button.click()
        time.sleep(2)
    
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptName")))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        happy_amplify = next((el for el in prompt_name_elements if el.text == "Torbek"), None,)
        self.assertIsNotNone(happy_amplify, "Torbek should be visible in the dropdown",)
        happy_amplify_button = happy_amplify.find_element(By.XPATH, "./ancestor::button")
        button_id = happy_amplify_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        happy_amplify_button.click()
        
        # id="groupSelector"
        group_selector = self.wait.until(EC.presence_of_element_located((By.ID, "groupSelector")))
        self.assertTrue(group_selector, "Group Selector elements should be visible")
    
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptName")))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        happy_amplify = next((el for el in prompt_name_elements if el.text == "Torbek"), None,)
        self.assertIsNotNone(happy_amplify, "Torbek should be visible in the dropdown",)
        happy_amplify_button = happy_amplify.find_element(By.XPATH, "./ancestor::button")
        button_id = happy_amplify_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")

        action = ActionChains(self.driver)
        action.move_to_element(happy_amplify_button).perform()
        time.sleep(2)

        edit_button = self.wait.until(EC.element_to_be_clickable((By.ID, "editTemplate")))
        self.assertIsNotNone(edit_button, "Edit button should be initialized and clicked")
        edit_button.click()
        
        time.sleep(5)
        
        # deleteAssistantButton
        delete_assistant_button = self.wait.until(EC.element_to_be_clickable((By.ID, "deleteAssistantButton")))
        self.assertIsNotNone(delete_assistant_button, "Delete Assistant button should be initialized and clicked")
        delete_assistant_button.click()
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")

        time.sleep(15)
    
    # ----------------- Test Create Group -----------------
    """Test that Features of creating a group and deleting the group"""
        
    def test_create_group(self):
        
        self.open_test_group_assistants()
        
        time.sleep(5) # Extra Look
        
        # id="selectGroup" select element, 
        select_group = self.wait.until(EC.presence_of_element_located((By.ID, "selectGroup")))
        for option in select_group.find_elements(By.TAG_NAME, "option"):
            if option.get_attribute("value") == "ADD":
                option.click()
                break
        
        time.sleep(2)
        
        # id="groupName" presence_of_element, .clear, time.sleep(1), .send_keys("Mario Party")
        group_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "groupName")))
        group_name_input.clear()
        time.sleep(1)
        group_name_input.send_keys("Mario Party")
        
        time.sleep(2)

        # id="addTag" element is clickable, click it, javascript alert appears, .clear, time.sleep(1), .send_keys("Player 1, Player 2, Player 3, Player 4") into it, then alert.accept
        add_tag_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addTag")))
        add_tag_button.click()
        alert = self.driver.switch_to.alert
        alert.send_keys("Player 1, Player 2, Player 3, Player 4")
        time.sleep(1)
        alert.accept()

        time.sleep(2)

        # id="emailInput" presence_of_element, .clear, time.sleep(1), .send_keys("charlie.perkins@vanderbilt.edu")
        email_input = self.wait.until(EC.presence_of_element_located((By.ID, "emailInput")))
        email_input.clear()
        time.sleep(1)
        email_input.send_keys("charlie.perkins@vanderbilt.edu")

        time.sleep(2)

        # id="addMembers" presence_of_element, .click
        add_members_button = self.wait.until(EC.presence_of_element_located((By.ID, "addMembers")))
        add_members_button.click()

        time.sleep(2)

        # id="selectAccessType" presence_of_element, this is a select element, look at options elements inside and select the one with value="admin"
        access_type_select = self.wait.until(EC.presence_of_element_located((By.ID, "selectAccessType")))
        for option in access_type_select.find_elements(By.TAG_NAME, "option"):
            if option.get_attribute("value") == "admin":
                option.click()
                break

        time.sleep(2)

        # id="confirmationButton" presence of all, find one with text 'Create Group', then click it
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        for button in confirmation_buttons:
            if button.text.strip() == "Create Group":
                button.click()
                break

        time.sleep(10)

        # id="groupManagement" presence_of_element, click it
        group_management_button = self.wait.until(EC.presence_of_element_located((By.ID, "groupManagement")))
        group_management_button.click()

        time.sleep(2)

        # id="addTag" element is clickable, do not click
        self.wait.until(EC.element_to_be_clickable((By.ID, "addTag")))
        time.sleep(2)

        # id="addUserButton" element is clickable, do not click
        add_user = self.wait.until(EC.element_to_be_clickable((By.ID, "addUserButton")))
        add_user.click()
        time.sleep(2)
        cancel_changes = self.wait.until(EC.element_to_be_clickable((By.ID, "cancelChanges")))
        cancel_changes.click()
        time.sleep(2)

        # id="Delete Users" element is clickable, do not click
        delete_user = self.wait.until(EC.element_to_be_clickable((By.ID, "Delete Users")))
        delete_user.click()
        time.sleep(2)
        cancel_changes = self.wait.until(EC.element_to_be_clickable((By.ID, "cancelChanges")))
        cancel_changes.click()
        time.sleep(2)

        # id="Update Users access" element is clickable, do not click
        update_user = self.wait.until(EC.element_to_be_clickable((By.ID, "Update Users access")))
        update_user.click()
        time.sleep(2)
        cancel_changes = self.wait.until(EC.element_to_be_clickable((By.ID, "cancelChanges")))
        cancel_changes.click()
        time.sleep(2)

        # id="deleteGroupButton" element is clickable, click it, Javascript alert appears you need to accept
        delete_group_button = self.wait.until(EC.element_to_be_clickable((By.ID, "deleteGroupButton")))
        delete_group_button.click()
        time.sleep(2)
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")

        time.sleep(10)
        
    # ----------------- Test Create Group and Create Assistant -----------------
    """Test that Features of creating a group and creating an assistant in the group"""
        
    def test_create_group_with_assistant(self):
        
        self.open_test_group_assistants()
        
        time.sleep(5) # Extra Look
        
        # id="selectGroup" select element, 
        select_group = self.wait.until(EC.presence_of_element_located((By.ID, "selectGroup")))
        for option in select_group.find_elements(By.TAG_NAME, "option"):
            if option.get_attribute("value") == "ADD":
                option.click()
                break
        
        time.sleep(2)
        
        # id="groupName" presence_of_element, .clear, time.sleep(1), .send_keys("Mario Party")
        group_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "groupName")))
        group_name_input.clear()
        time.sleep(1)
        group_name_input.send_keys("Mario Party")
        
        time.sleep(2)

        # id="addTag" element is clickable, click it, javascript alert appears, .clear, time.sleep(1), .send_keys("Player 1, Player 2, Player 3, Player 4") into it, then alert.accept
        add_tag_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addTag")))
        add_tag_button.click()
        alert = self.driver.switch_to.alert
        alert.send_keys("Player 1, Player 2, Player 3, Player 4")
        time.sleep(1)
        alert.accept()

        time.sleep(2)

        # id="emailInput" presence_of_element, .clear, time.sleep(1), .send_keys("charlie.perkins@vanderbilt.edu")
        email_input = self.wait.until(EC.presence_of_element_located((By.ID, "emailInput")))
        email_input.clear()
        time.sleep(1)
        email_input.send_keys("charlie.perkins@vanderbilt.edu")

        time.sleep(2)

        # id="addMembers" presence_of_element, .click
        add_members_button = self.wait.until(EC.presence_of_element_located((By.ID, "addMembers")))
        add_members_button.click()

        time.sleep(2)

        # id="selectAccessType" presence_of_element, this is a select element, look at options elements inside and select the one with value="admin"
        access_type_select = self.wait.until(EC.presence_of_element_located((By.ID, "selectAccessType")))
        for option in access_type_select.find_elements(By.TAG_NAME, "option"):
            if option.get_attribute("value") == "admin":
                option.click()
                break

        time.sleep(2)

        # id="confirmationButton" presence of all, find one with text 'Create Group', then click it
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        for button in confirmation_buttons:
            if button.text.strip() == "Create Group":
                button.click()
                break

        time.sleep(10)
        
        # id="createAssistantButton" 
        create_assistant_button = self.wait.until(EC.element_to_be_clickable((By.ID, "createAssistantButton")))
        create_assistant_button.click()
        
        time.sleep(2)
        
        # Interact with the "trackConversations" toggle
        track_toggle = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'label[for="trackConversations"]'))
        )
        track_toggle.click()
        time.sleep(2)
        
        # Check for presence of all 4 checkboxes with id="typeCheckBox"
        type_checkboxes = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "typeCheckBox"))
        )
        self.assertEqual(len(type_checkboxes), 4, "There should be exactly 4 type checkboxes")

        # Verify all four are unchecked
        for i in range(3):
            is_checked = type_checkboxes[i].is_selected()
            self.assertFalse(is_checked, f"Type checkbox {i+1} should be checked")

        type_checkboxes[0].click()
        
        assistant_name = self.wait.until(EC.presence_of_element_located((By.ID, "assistantName")))
        assistant_name.clear()
        time.sleep(1)
        assistant_name.send_keys("Daisy")
        time.sleep(2)
        
        save_button = self.wait.until(EC.element_to_be_clickable((By.ID, "saveButton")))
        save_button.click()
        time.sleep(10)
        
        close_button = self.wait.until(EC.element_to_be_clickable((By.ID, "closeModal")))
        close_button.click()
        time.sleep(2)
        
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "dropName")))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        dropdown_button = next((el for el in drop_name_elements if el.text == "Mario Party"), None)
        self.assertIsNotNone(dropdown_button, "Team Assistant button should be present")
        dropdown_button.click()
        time.sleep(2)
    
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptName")))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        amplify_assistant = next((el for el in prompt_name_elements if el.text == "Daisy"), None,)
        self.assertIsNotNone(amplify_assistant, "Daisy should be visible in the dropdown",)
        amplify_assistant_button = amplify_assistant.find_element(By.XPATH, "./ancestor::button")
        button_id = amplify_assistant_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        amplify_assistant_button.click()
        
        time.sleep(2) # View Usability
        
        group_type_check = self.wait.until(EC.presence_of_all_elements_located((By.ID, "groupTypeCheck")))
        self.assertTrue(group_type_check, "Group Type Check elements should be initialized")
        
        # Extract value attributes into a list
        group_type_values = []
        for element in group_type_check:
            value = element.get_attribute("value")
            if value is not None:
                group_type_values.append(value)
        
        expected_group_values = ['Player 1']
        
        self.assertEqual(group_type_values, expected_group_values, "The expected group types are equal to the extracted ones.")
        
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "dropName")))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        dropdown_button = next((el for el in drop_name_elements if el.text == "Mario Party"), None)
        self.assertIsNotNone(dropdown_button, "Team Assistant button should be present")
        
        action = ActionChains(self.driver)
        action.move_to_element(dropdown_button).perform()

        # Locate and click the "Assistant Admin Interface" button
        assistant_admin_interface_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "assistantAdminInterfaceButton"))
        )
        self.assertIsNotNone(
            assistant_admin_interface_button, "Edit button should be initialized and clicked"
        )
        assistant_admin_interface_button.click()
        
        time.sleep(5)
        
        # id="groupManagement" presence_of_element, click it
        group_management_button = self.wait.until(EC.presence_of_element_located((By.ID, "groupManagement")))
        group_management_button.click()

        time.sleep(2)
        
        # id="deleteGroupButton" element is clickable, click it, Javascript alert appears you need to accept
        delete_group_button = self.wait.until(EC.element_to_be_clickable((By.ID, "deleteGroupButton")))
        delete_group_button.click()
        time.sleep(2)
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
        
        close_button = self.wait.until(EC.element_to_be_clickable((By.ID, "closeModal")))
        close_button.click()
        time.sleep(2)

        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "dropName")))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        dropdown_button = next((el for el in drop_name_elements if el.text == "Mario Party"), None)
        self.assertIsNone(dropdown_button, "Team Assistant button should not be present")
        
    

if __name__ == "__main__":
    unittest.main(verbosity=2)

    