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


class ScheduledTasksModalTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)
        
    def settings_setup(self):
        time.sleep(5)

        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'")

        settings_tab = next((tab for tab in tabs if tab.get_attribute("title") == "Settings"), None)
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")
        settings_tab.click()

        side_bar_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBarButton")))
        self.assertGreater(len(side_bar_buttons), 1, "Expected multiple buttons with ID 'sideBarButton'")

        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Scheduled Tasks":
                    target_button = button
                    break
            except:
                continue 

        self.assertIsNotNone(target_button, "The 'Scheduled Tasks' button should be present")
        target_button.click()
        time.sleep(2)
        
    # ----------------- Test Presence -----------------
    """Test the Presence of all the elements in the Scheduled Tasks Modal"""

    def test_settings_export_conversations(self):
        # Extra sleep for extra loading
        time.sleep(3)
        self.settings_setup()
        time.sleep(2)
        
        # --- Clickable buttons ---
        add_new_task_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "addNewTask")))
        self.assertTrue(add_new_task_btn, "addNewTask should be clickable")

        expand_understanding_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "expandComponent-Understanding Scheduled Tasks")))
        self.assertTrue(expand_understanding_btn, "expandComponent-Understanding Scheduled Tasks should be clickable")

        expand_configure_time_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "expandComponent-Configure Scheduled Time")))
        self.assertTrue(expand_configure_time_btn, "expandComponent-Configure Scheduled Time should be clickable")

        # --- Inputs / textareas ---
        task_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "taskNameInput")))
        task_name_input.send_keys("Project Hail Mary")
        self.assertTrue(task_name_input, "taskNameInput should accept input")

        description_input = self.wait.until(EC.presence_of_element_located((By.ID, "descriptionInput")))
        description_input.send_keys("Mission to stop Astrophage")
        self.assertTrue(description_input, "descriptionInput should accept input")

        task_instructions_input = self.wait.until(EC.presence_of_element_located((By.ID, "taskInstructionsInput")))
        task_instructions_input.send_keys("Save Earth")
        self.assertTrue(task_instructions_input, "taskInstructionsInput should accept input")

        # --- Select elements ---
        scheduled_time_select = self.wait.until(EC.presence_of_element_located((By.ID, "scheduledTimeSelect")))
        self.assertTrue(scheduled_time_select, "scheduledTimeSelect should be present")

        hour_select = self.wait.until(EC.presence_of_element_located((By.ID, "hourSelect")))
        self.assertTrue(hour_select, "hourSelect should be present")

        minute_select = self.wait.until(EC.presence_of_element_located((By.ID, "minuteSelect")))
        self.assertTrue(minute_select, "minuteSelect should be present")

        task_type_select = self.wait.until(EC.presence_of_element_located((By.ID, "taskTypeSelect")))
        self.assertTrue(task_type_select, "taskTypeSelect should be present")

        auto_populate_select = self.wait.until(EC.presence_of_element_located((By.ID, "autoPopulateSelect")))
        self.assertTrue(auto_populate_select, "autoPopulateSelect should be present")

        # --- Checkbox inputs ---
        enable_date_range = self.wait.until(EC.presence_of_element_located((By.ID, "enableDateRange")))
        self.assertTrue(enable_date_range, "enableDateRange checkbox should be present")

        active_checkbox = self.wait.until(EC.presence_of_element_located((By.ID, "activeCheckbox")))
        self.assertTrue(active_checkbox, "activeCheckbox checkbox should be present")

        notify_completion_checkbox = self.wait.until(EC.presence_of_element_located((By.ID, "notifyCompletionCheckbox")))
        self.assertTrue(notify_completion_checkbox, "notifyCompletionCheckbox checkbox should be present")

        notify_failure_checkbox = self.wait.until(EC.presence_of_element_located((By.ID, "notifyFailureCheckbox")))
        self.assertTrue(notify_failure_checkbox, "notifyFailureCheckbox checkbox should be present")

        # --- Input text fields ---
        tag_input = self.wait.until(EC.presence_of_element_located((By.ID, "tagInput")))
        tag_input.send_keys("test tag")
        self.assertTrue(tag_input, "tagInput should accept input")

        email_input = self.wait.until(EC.presence_of_element_located((By.ID, "emailInput")))
        email_input.send_keys("test@email.com")
        self.assertTrue(email_input, "emailInput should accept input")

        # --- Confirmation buttons ---
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertGreater(len(confirmation_buttons), 0, "There should be confirmation buttons present")
        
    # ----------------- Test Save a Task and Delete it -----------------
    """Test you can save and delete a task in the Scheduled Tasks Modal"""

    def test_save_a_task(self):
        # Extra sleep for extra loading
        time.sleep(3)
        self.settings_setup()
        time.sleep(2)
        
        task_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "taskNameInput")))
        task_name_input.send_keys("Project Hail Mary")
        self.assertTrue(task_name_input, "taskNameInput should accept input")
        time.sleep(1)

        description_input = self.wait.until(EC.presence_of_element_located((By.ID, "descriptionInput")))
        description_input.send_keys("Mission to stop Astrophage")
        self.assertTrue(description_input, "descriptionInput should accept input")
        time.sleep(1)

        task_instructions_input = self.wait.until(EC.presence_of_element_located((By.ID, "taskInstructionsInput")))
        task_instructions_input.send_keys("Save Earth")
        self.assertTrue(task_instructions_input, "taskInstructionsInput should accept input")
        time.sleep(1)
        
        # presence of id="expandComponent-Configure Scheduled Time"
        expand_component = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent-Configure Scheduled Time")))
        self.assertTrue(expand_component, "Expand component for scheduled time should be present")
        if expand_component.get_attribute("title") != "Collapse":
            expand_component.click()
            time.sleep(1)

        # id="scheduledTimeSelect" select option "Daily"
        scheduled_time_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "scheduledTimeSelect"))))
        scheduled_time_select.select_by_visible_text("Daily")
        time.sleep(1)

        # id="hourSelect" select option "10 AM"
        hour_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "hourSelect"))))
        hour_select.select_by_visible_text("10 AM")
        time.sleep(1)

        # id="minuteSelect" select option "42"
        minute_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "minuteSelect"))))
        minute_select.select_by_visible_text("42")
        time.sleep(1)

        # id="enableDateRange" checkbox click
        enable_date_range = self.wait.until(EC.presence_of_element_located((By.ID, "enableDateRange")))
        enable_date_range.click()
        time.sleep(1)

        # id="startDateInput" input present and send keys 12312999
        start_date_input = self.wait.until(EC.presence_of_element_located((By.ID, "startDateInput")))
        start_date_input.send_keys("12312999")
        self.assertTrue(start_date_input, "startDateInput should accept input")
        time.sleep(1)

        # id="endDateInput" input present and send keys 01013000
        end_date_input = self.wait.until(EC.presence_of_element_located((By.ID, "endDateInput")))
        end_date_input.send_keys("01013000")
        self.assertTrue(end_date_input, "endDateInput should accept input")
        time.sleep(1)

        # id="activeCheckbox" checkbox check if checked, if not then click
        active_checkbox = self.wait.until(EC.presence_of_element_located((By.ID, "activeCheckbox")))
        if not active_checkbox.is_selected():
            active_checkbox.click()
        self.assertTrue(active_checkbox.is_selected(), "activeCheckbox should be selected")
        time.sleep(1)

        # id="taskTypeSelect" select option "Assistant"
        task_type_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "taskTypeSelect"))))
        task_type_select.select_by_visible_text("Assistant")
        time.sleep(1)

        # id="autoPopulateSelect" select option "Donkey Kong"
        auto_populate_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "autoPopulateSelect"))))
        auto_populate_select.select_by_visible_text("Donkey Kong")
        time.sleep(1)
        
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertGreater(len(confirmation_buttons), 0, "There should be confirmation buttons present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(10) # Wait for Scheduled task saved
        
        # Locate the task container dynamically by its child text
        task_assistant = self.wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//div[starts-with(@id,'task_assistant_')]//div[@id='taskName' and normalize-space()='Project Hail Mary']/ancestor::div[starts-with(@id,'task_assistant_')]")
            )
        )
        self.assertTrue(task_assistant, "Task assistant for 'Project Hail Mary' should be present after saving")

        # Extract and verify taskName inside that container
        task_name_display = task_assistant.find_element(By.ID, "taskName")
        self.assertEqual(task_name_display.text.strip(), "Project Hail Mary")

        time.sleep(2)

        # Find and click delete button inside that container
        delete_button = task_assistant.find_element(By.ID, "deleteTask")
        delete_button.click()
        time.sleep(2)

        # Confirm invisibility of the task with this name
        self.wait.until(
            EC.invisibility_of_element_located((By.XPATH, "//div[@id='taskName' and normalize-space()='Project Hail Mary']"))
        )
        
        
    # ----------------- Test Error Checks -----------------
    """Test error checks in the Scheduled Tasks Modal"""

    def test_error_check(self):
        # Extra sleep for extra loading
        time.sleep(3)
        self.settings_setup()
        time.sleep(2)
        
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertGreater(len(confirmation_buttons), 0, "There should be confirmation buttons present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(2)
        
        # id="errorPresent"
        error_present = self.wait.until(EC.presence_of_element_located((By.ID, "errorPresent")))
        self.assertTrue(error_present, "Error should be present after attempting to save")
        
        self.assertEqual(error_present.text.strip(), "Task name is required")
        
        time.sleep(2)
        
        task_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "taskNameInput")))
        task_name_input.send_keys("Ryland Grace")
        self.assertTrue(task_name_input, "taskNameInput should accept input")
        time.sleep(2)
        
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertGreater(len(confirmation_buttons), 0, "There should be confirmation buttons present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(2)
        
        # id="errorPresent"
        error_present = self.wait.until(EC.presence_of_element_located((By.ID, "errorPresent")))
        self.assertTrue(error_present, "Error should be present after attempting to save")
        
        self.assertEqual(error_present.text.strip(), 'An object must be selected under "Task Type"')
        
        time.sleep(2)
        
        # id="autoPopulateSelect" select option "Zelda"
        auto_populate_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "autoPopulateSelect"))))
        auto_populate_select.select_by_visible_text("Zelda")
        time.sleep(2)
        
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertGreater(len(confirmation_buttons), 0, "There should be confirmation buttons present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(10) # Wait for Scheduled task saved
        
        # Locate the task container dynamically by its child text
        task_assistant = self.wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//div[starts-with(@id,'task_assistant_')]//div[@id='taskName' and normalize-space()='Ryland Grace']/ancestor::div[starts-with(@id,'task_assistant_')]")
            )
        )
        self.assertTrue(task_assistant, "Task assistant for 'Ryland Grace' should be present after saving")

        # Extract and verify taskName inside that container
        task_name_display = task_assistant.find_element(By.ID, "taskName")
        self.assertEqual(task_name_display.text.strip(), "Ryland Grace")

        time.sleep(2)

        # Find and click delete button inside that container
        delete_button = task_assistant.find_element(By.ID, "deleteTask")
        delete_button.click()
        time.sleep(2)

        # Confirm invisibility of the task with this name
        self.wait.until(
            EC.invisibility_of_element_located((By.XPATH, "//div[@id='taskName' and normalize-space()='Ryland Grace']"))
        )
        
    # ----------------- Test Schedule Change -----------------
    """Test you can modify the Schedule changes in the Scheduled Tasks Modal"""

    def test_schedule_check(self):
        # Extra sleep for extra loading
        time.sleep(3)
        self.settings_setup()
        time.sleep(2)
        
        # presence of id="expandComponent-Configure Scheduled Time"
        expand_component = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent-Configure Scheduled Time")))
        self.assertTrue(expand_component, "Expand component for scheduled time should be present")
        if expand_component.get_attribute("title") != "Collapse":
            expand_component.click()
            time.sleep(1)

        # id="scheduledTimeSelect" select option "Daily"
        scheduled_time_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "scheduledTimeSelect"))))
        scheduled_time_select.select_by_visible_text("Daily")
        time.sleep(1)

        # id="hourSelect" select option "10 AM"
        hour_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "hourSelect"))))
        hour_select.select_by_visible_text("10 AM")
        time.sleep(1)

        # id="minuteSelect" select option "17"
        minute_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "minuteSelect"))))
        minute_select.select_by_visible_text("17")
        time.sleep(1)
        
        expand_component = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent-Configure Scheduled Time")))
        self.assertTrue(expand_component, "Expand component for scheduled time should be present")
        expand_component.click()
        time.sleep(1)
        
        # scheduleIndex0
        schedule_present = self.wait.until(EC.presence_of_element_located((By.ID, "scheduleIndex0")))
        self.assertTrue(schedule_present, "Schedule should be present after attempting to save")
        
        self.assertEqual(schedule_present.text.strip(), "Daily at 10:17 AM")
        
        time.sleep(2)
        
        # presence of id="expandComponent-Configure Scheduled Time"
        expand_component = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent-Configure Scheduled Time")))
        self.assertTrue(expand_component, "Expand component for scheduled time should be present")
        if expand_component.get_attribute("title") != "Collapse":
            expand_component.click()
            time.sleep(1)

        # id="scheduledTimeSelect" select option "Weekly"
        scheduled_time_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "scheduledTimeSelect"))))
        scheduled_time_select.select_by_visible_text("Weekly")
        time.sleep(1)
        
        # id="daySelect" select option "Wednesday"
        day_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "daySelect"))))
        day_select.select_by_visible_text("Wednesday")
        time.sleep(1)
        
        # id="hourSelect" select option "1 AM"
        hour_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "hourSelect"))))
        hour_select.select_by_visible_text("1 AM")
        time.sleep(1)

        # id="minuteSelect" select option "59"
        minute_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "minuteSelect"))))
        minute_select.select_by_visible_text("59")
        time.sleep(1)
        
        expand_component = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent-Configure Scheduled Time")))
        self.assertTrue(expand_component, "Expand component for scheduled time should be present")
        expand_component.click()
        time.sleep(1)
        
        # scheduleIndex0
        schedule_present = self.wait.until(EC.presence_of_element_located((By.ID, "scheduleIndex0")))
        self.assertTrue(schedule_present, "Schedule should be present after attempting to save")
        
        self.assertEqual(schedule_present.text.strip(), "Weekly on Wednesday at 1:59 AM")
        
        time.sleep(2)
        
        # presence of id="expandComponent-Configure Scheduled Time"
        expand_component = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent-Configure Scheduled Time")))
        self.assertTrue(expand_component, "Expand component for scheduled time should be present")
        if expand_component.get_attribute("title") != "Collapse":
            expand_component.click()
            time.sleep(1)

        # id="scheduledTimeSelect" select option "Monthly"
        scheduled_time_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "scheduledTimeSelect"))))
        scheduled_time_select.select_by_visible_text("Monthly")
        time.sleep(1)
        
        # id="daySelect" select option "20"
        day_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "dayOfMonthSelect"))))
        day_select.select_by_visible_text("20")
        time.sleep(1)
        
        # id="hourSelect" select option "5 PM"
        hour_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "hourSelect"))))
        hour_select.select_by_visible_text("5 PM")
        time.sleep(1)

        # id="minuteSelect" select option "00"
        minute_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "minuteSelect"))))
        minute_select.select_by_visible_text("00")
        time.sleep(1)
        
        expand_component = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent-Configure Scheduled Time")))
        self.assertTrue(expand_component, "Expand component for scheduled time should be present")
        expand_component.click()
        time.sleep(1)
        
        # scheduleIndex0
        schedule_present = self.wait.until(EC.presence_of_element_located((By.ID, "scheduleIndex0")))
        self.assertTrue(schedule_present, "Schedule should be present after attempting to save")
        
        self.assertEqual(schedule_present.text.strip(), "Monthly on day 20 at 5:00 PM")
        
        time.sleep(2)
        
        # presence of id="expandComponent-Configure Scheduled Time"
        expand_component = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent-Configure Scheduled Time")))
        self.assertTrue(expand_component, "Expand component for scheduled time should be present")
        if expand_component.get_attribute("title") != "Collapse":
            expand_component.click()
            time.sleep(1)

        # id="scheduledTimeSelect" select option "Custom"
        scheduled_time_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "scheduledTimeSelect"))))
        scheduled_time_select.select_by_visible_text("Custom")
        time.sleep(1)
        
        # id="hourSelect" select option "7 AM"
        hour_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "hourSelect"))))
        hour_select.select_by_visible_text("7 AM")
        time.sleep(1)

        # id="minuteSelect" select option "07"
        minute_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "minuteSelect"))))
        minute_select.select_by_visible_text("07")
        time.sleep(1)
        
        # id="daySelect" select option "Sunday"
        day_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "daySelect"))))
        day_select.select_by_visible_text("Sunday")
        time.sleep(1)
        
        # monthSelect
        month_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "monthSelect"))))
        month_select.select_by_visible_text("July")
        time.sleep(1)
        
        # id="daySelect" select option "7"
        day_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "dayOfMonthSelect"))))
        day_select.select_by_visible_text("7")
        time.sleep(1)
        
        expand_component = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent-Configure Scheduled Time")))
        self.assertTrue(expand_component, "Expand component for scheduled time should be present")
        expand_component.click()
        time.sleep(1)
        
        # scheduleIndex0
        schedule_present = self.wait.until(EC.presence_of_element_located((By.ID, "scheduleIndex0")))
        self.assertTrue(schedule_present, "Schedule should be present after attempting to save")
        
        self.assertEqual(schedule_present.text.strip(), "Annually on July 7 at 7:07 AM")
        
        time.sleep(2)
        
    # ----------------- Test Task Type -----------------
    """Test that you can modify the Task Type in the Scheduled Tasks Modal"""

    def test_task_type_check(self):
        # Extra sleep for extra loading
        time.sleep(3)
        self.settings_setup()
        time.sleep(2)
        
        # id="taskTypeSelect" select option "Assistant"
        task_type_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "taskTypeSelect"))))
        task_type_select.select_by_visible_text("Assistant")
        time.sleep(1)
        
        # id="autoPopulateSelect"
        auto_populate_select = self.wait.until(EC.presence_of_element_located((By.ID, "autoPopulateSelect")))
        self.assertTrue(auto_populate_select, "Assistant Select is present after selecting it in task")
        time.sleep(1)
        
        # id="taskTypeSelect" select option ""
        task_type_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "taskTypeSelect"))))
        task_type_select.select_by_visible_text("Action Set")
        time.sleep(1)
        
        # id="actionSetSelect"
        action_set_select_present = self.wait.until(EC.presence_of_element_located((By.ID, "actionSetSelect")))
        self.assertTrue(action_set_select_present, "Action Set Select is present after selecting it in task")
        time.sleep(1)
        
        # id="taskTypeSelect" select option ""
        task_type_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "taskTypeSelect"))))
        task_type_select.select_by_visible_text("API Action")
        time.sleep(1)
        
        # id="apiToolSelect"
        api_tool_select_present = self.wait.until(EC.presence_of_element_located((By.ID, "apiToolSelect")))
        self.assertTrue(api_tool_select_present, "API Tool Select is present after selecting it in task")
        time.sleep(1)
        
    # ----------------- Test Save Task Type -----------------
    # ONLY PASSES WITH THE SPEICIFC CUSTOM API TASK
    """Test that you can save the modified the Task Type in the Scheduled Tasks Modal"""

    def test_save_task_type(self):
        # Extra sleep for extra loading
        time.sleep(3)
        self.settings_setup()
        time.sleep(2)
        
        task_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "taskNameInput")))
        task_name_input.send_keys("Luigi Jump")
        self.assertTrue(task_name_input, "taskNameInput should accept input")
        time.sleep(1)
        
        # id="taskTypeSelect" select option "Assistant"
        task_type_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "taskTypeSelect"))))
        task_type_select.select_by_visible_text("Assistant")
        time.sleep(1)
        
        # id="autoPopulateSelect"
        auto_populate_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "autoPopulateSelect"))))
        auto_populate_select.select_by_visible_text("Zelda")
        time.sleep(2)
        
        # id="hourSelect" select option "10 AM"
        hour_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "hourSelect"))))
        hour_select.select_by_visible_text("10 AM")
        time.sleep(1)
        
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertGreater(len(confirmation_buttons), 0, "There should be confirmation buttons present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(10) # Wait for Scheduled task saved
        
        scheduled_assistant_title = self.wait.until(EC.presence_of_element_located((By.ID, "scheduled_assistant")))
        self.assertTrue(scheduled_assistant_title, "scheduled_assistant title should be present")
        time.sleep(1)
        
        # Locate the task container dynamically by its child text
        task_assistant = self.wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//div[starts-with(@id,'task_assistant_')]//div[@id='taskName' and normalize-space()='Luigi Jump']/ancestor::div[starts-with(@id,'task_assistant_')]")
            )
        )
        self.assertTrue(task_assistant, "Task assistant for 'Luigi Jump' should be present after saving")

        # Extract and verify taskName inside that container
        task_name_display = task_assistant.find_element(By.ID, "taskName")
        self.assertEqual(task_name_display.text.strip(), "Luigi Jump")

        time.sleep(2)

        # Find and click delete button inside that container
        delete_button = task_assistant.find_element(By.ID, "deleteTask")
        delete_button.click()
        time.sleep(2)

        # Confirm invisibility of the task with this name
        self.wait.until(
            EC.invisibility_of_element_located((By.XPATH, "//div[@id='taskName' and normalize-space()='Luigi Jump']"))
        )
        time.sleep(1)
        
        add_new_task_btn = self.wait.until(EC.element_to_be_clickable((By.ID, "addNewTask")))
        self.assertTrue(add_new_task_btn, "addNewTask should be clickable")
        add_new_task_btn.click()
        time.sleep(2)
        
        task_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "taskNameInput")))
        task_name_input.send_keys("Mario Jump")
        self.assertTrue(task_name_input, "taskNameInput should accept input")
        time.sleep(1)
        
        # id="taskTypeSelect" select option ""
        task_type_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "taskTypeSelect"))))
        task_type_select.select_by_visible_text("Action Set")
        time.sleep(1)
        
        # id="actionSetSelect"
        action_set_select_present = self.wait.until(EC.presence_of_element_located((By.ID, "actionSetSelect")))
        self.assertTrue(action_set_select_present, "Action Set Select is present after selecting it in task")
        time.sleep(1)
        
        # id="taskTypeSelect" select option ""
        task_type_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "taskTypeSelect"))))
        task_type_select.select_by_visible_text("API Action")
        time.sleep(1)
        
        # id="apiToolSelect"
        api_tool_select_present = self.wait.until(EC.presence_of_element_located((By.ID, "apiToolSelect")))
        self.assertTrue(api_tool_select_present, "API Tool Select is present after selecting it in task")
        api_tool_select_present.click()
        time.sleep(1)
        
        # customAPIButton
        custom_api_button_present = self.wait.until(EC.presence_of_element_located((By.ID, "customAPIButton")))
        self.assertTrue(custom_api_button_present, "Custom API Tool Button is present after selecting it in task")
        time.sleep(1)
        
        # internalAPIButton
        internal_api_button_present = self.wait.until(EC.presence_of_element_located((By.ID, "internalAPIButton")))
        self.assertTrue(internal_api_button_present, "Internal API Tool Button is present after selecting it in task")
        time.sleep(1)
        
        # toolsAPIButton
        tools_api_button_present = self.wait.until(EC.presence_of_element_located((By.ID, "toolsAPIButton")))
        self.assertTrue(tools_api_button_present, "Custom API Tool Button is present after selecting it in task")
        time.sleep(1)
        
        custom_api_button_present.click()
        time.sleep(1)
        
        # --- Locate and click the correct API element ---
        api_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "apiName")))
        self.assertGreater(len(api_name_elements), 0, "There should be at least one API name element present")

        target_name = "Calculate_drake_equation"
        found = False

        for api_name_el in api_name_elements:
            name_text = api_name_el.text.strip()
            if name_text == target_name:
                # Move up to the parent element (with id="apiClick")
                parent_click_el = api_name_el.find_element(By.XPATH, "./ancestor::*[@id='apiClick']")
                self.assertTrue(parent_click_el, f"Found parent element for {target_name}")
                parent_click_el.click()
                found = True
                break

        self.assertTrue(found, f"Expected to find API with name '{target_name}' but did not.")
        time.sleep(1)

        # id="hourSelect" select option "12 AM"
        hour_select = Select(self.wait.until(EC.presence_of_element_located((By.ID, "hourSelect"))))
        hour_select.select_by_visible_text("12 AM")
        time.sleep(1)
        
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertGreater(len(confirmation_buttons), 0, "There should be confirmation buttons present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(20) # Wait for Scheduled task saved
        
        scheduled_apiTool_title = self.wait.until(EC.presence_of_element_located((By.ID, "scheduled_apiTool")))
        self.assertTrue(scheduled_apiTool_title, "scheduled_apiTool title should be present")
        time.sleep(1)
        
        # Locate the task container dynamically by its child text
        task_assistant = self.wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//div[starts-with(@id,'task_apiTool_')]//div[@id='taskName' and normalize-space()='Mario Jump']/ancestor::div[starts-with(@id,'task_apiTool_')]")
            )
        )
        self.assertTrue(task_assistant, "Task assistant for 'Mario Jump' should be present after saving")

        # Extract and verify taskName inside that container
        task_name_display = task_assistant.find_element(By.ID, "taskName")
        self.assertEqual(task_name_display.text.strip(), "Mario Jump")

        time.sleep(2)

        # Find and click delete button inside that container
        delete_button = task_assistant.find_element(By.ID, "deleteTask")
        delete_button.click()
        time.sleep(2)

        # Confirm invisibility of the task with this name
        self.wait.until(
            EC.invisibility_of_element_located((By.XPATH, "//div[@id='taskName' and normalize-space()='Mario Jump']"))
        )
        
        
if __name__ == "__main__":
    unittest.main(verbosity=2)
