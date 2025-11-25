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

class FileInclusionTests(BaseTest):
    """
    Test suite for file upload and viewing functionality.

    These tests verify that various file types can be:
    - Uploaded through the file input interface
    - Processed and read by the system
    - Viewed and categorized correctly in the Files Menu
    - Sent as part of chat messages to the LLM

    Supported file types tested: txt, pdf, pptx (PowerPoint), docx (Word), md (Markdown), html, csv
    """

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------
    def upload_file(self, filename):
        """
        Helper method to upload a file from the test_files directory.

        This method:
        1. Constructs the absolute path to the test file
        2. Makes the hidden file input visible via JavaScript
        3. Sends the file path to the input element
        4. Waits for the file to upload and be processed

        Args:
            filename (str): Name of the file in the test_files directory

        Note:
            The 35-second wait is intentional to ensure:
            - File upload completes successfully
            - File content is fully processed by the backend
            - File is ready to be used in chat interactions
        """
        print("Starting upload_file function...")

        # Validate that a filename was provided
        if not filename:
            print("Filename is empty or None!")
            return

        # Construct absolute path to test file
        # Navigate up one level from tests directory to find test_files
        file_path = os.path.join(os.path.dirname(__file__), "..", "test_files", filename)
        file_path = os.path.normpath(file_path)  # Normalize path for current OS
        # print(f"Resolved absolute file path: {file_path}")

        # Verify the test file exists before attempting upload
        if not os.path.exists(file_path):
            print(f"File does NOT exist: {file_path}")
            return
        else:
            print("File exists!")

        # print(f"Uploading file: {file_path}")

        # Locate the hidden file input element
        file_input = self.driver.find_element(By.ID, "__attachFile")

        # Make the input visible using JavaScript (it's hidden by default)
        self.driver.execute_script("arguments[0].classList.remove('sr-only');", file_input)
        self.driver.execute_script("arguments[0].style.display = 'block';", file_input)

        # print("Sending file to input field...")
        # Send the file path to trigger the upload
        file_input.send_keys(file_path)

        # Wait for file upload and processing to complete
        # This extended wait (35 seconds) ensures:
        # - File is fully uploaded to the server
        # - File content is extracted and processed
        # - File is ready to be referenced in chat messages
        time.sleep(35) 
        
    def sidebar_press(self):
        """
        Helper method to ensure the sidebar is in the expanded state.

        This method checks the current sidebar state and expands it if necessary:
        - If "collapseSidebar" button is visible, sidebar is already open (do nothing)
        - If "collapseSidebar" button is not found, sidebar is closed (expand it)

        This defensive check ensures tests work regardless of initial sidebar state.
        """
        # Brief wait for sidebar state to stabilize
        time.sleep(1)

        try:
            # Check if the collapse button exists and is visible
            # If it exists, the sidebar is already expanded
            collapse_sidebar = self.driver.find_element(By.ID, "collapseSidebar")
            if collapse_sidebar.is_displayed():
                # Sidebar is already open; no action needed
                return
        except:
            # Exception means the collapse button doesn't exist
            # This indicates the sidebar is currently closed, so we need to expand it
            expand_sidebar_button = self.wait.until(
                EC.presence_of_element_located((By.ID, "expandSidebar"))
            )
            self.assertTrue(expand_sidebar_button.is_displayed(), "Expand Sidebar Button is visible")
            expand_sidebar_button.click()
        
    def send_message(self, message):
        """
        Helper method to send a chat message.

        Args:
            message (str): The text message to send in the chat

        Note:
            The 30-second wait after sending allows sufficient time for:
            - LLM to process the message
            - LLM to read and analyze uploaded files referenced in the message
            - Response to be generated and displayed
        """
        # Locate the chat input text area
        chat_input_bar = self.wait.until(EC.presence_of_element_located((By.ID, "messageChatInputText")))
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        chat_input_bar.send_keys(message)

        # Wait for text input to be fully processed
        time.sleep(2)

        # Locate and click the send message button
        chat_send_message = self.wait.until(EC.presence_of_element_located((By.ID, "sendMessage")))
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        chat_send_message.click()

        # Extended wait for LLM to process message and read attached files
        time.sleep(30)
        
    # ----------------- Test Files Inclusion -----------------
    """This test ensures that an uploaded txt file can be viewed in the Files Menu"""
    def test_file_inclusions_menu(self):
        """
        Test that a text (.txt) file can be uploaded and appears in the Files Menu.

        Verification steps:
        1. Upload a .txt file
        2. Send a message referencing the file
        3. Open the View Files menu
        4. Verify the file appears in the default files table
        """
        # Upload a test text file
        self.upload_file("Test_3.txt")

        # Send a message that references the uploaded file
        self.send_message("What does this file hold?")

        # Open the Files menu by clicking the view files button
        view_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "viewFiles")))
        self.assertTrue(view_files_button.is_displayed(), "View Files Button element is visible")

        view_files_button.click()

        # Wait for the menu animation to complete
        time.sleep(2)

        # Verify the Files Menu is now visible
        view_files_menu = self.wait.until(EC.presence_of_element_located((By.ID, "viewFilesMenu")))
        self.assertTrue(view_files_menu.is_displayed(), "View Files Menu is visible")

        # Wait for the file table to populate with data
        time.sleep(2)  # Give time for table data to load

        # Locate the table body element (using CSS selector for Mantine-generated class)
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows to search for our uploaded file
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Search through all rows and columns for the uploaded filename
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_3.txt":
                    found = True
                    break
            if found:
                break

        # Assert that the uploaded file appears in the table
        self.assertTrue(found, "Test_3.txt should be present in the files table.")

        # Brief wait before test completion
        time.sleep(3)
        
    # ----------------- Test Files PDF -----------------
    """This test ensures that an uploaded pdf can be viewed in the Files Menu"""

    def test_file_inclusions_doc_menu(self):
        """
        Test that a PDF file can be uploaded and appears in the Docs section of the Files Menu.

        PDF files are categorized as "docs" along with Word, Markdown, HTML files.
        This test verifies proper file categorization.

        Verification steps:
        1. Ensure sidebar is expanded
        2. Upload a .pdf file
        3. Send a message referencing the file
        4. Open the View Files menu
        5. Navigate to the "Docs" section
        6. Verify the file appears in the docs table
        """
        # Ensure the sidebar is in the expanded state for this test
        self.sidebar_press()

        # Wait for UI to stabilize after sidebar interaction
        time.sleep(3)  # Give time for any UI changes

        # Upload a test PDF file
        self.upload_file("Test_4.pdf")

        # Send a message that references the uploaded file
        self.send_message("What does this file hold?")

        # Open the Files menu by clicking the view files button
        view_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "viewFiles")))
        self.assertTrue(view_files_button.is_displayed(), "View File Button element is visible")

        view_files_button.click()

        # Wait for the menu animation to complete
        time.sleep(2)

        # Verify the Files Menu is now visible
        view_files_menu = self.wait.until(EC.presence_of_element_located((By.ID, "viewFilesMenu")))
        self.assertTrue(view_files_menu.is_displayed(), "View Files Menu is visible")

        # Wait for menu tabs to be available
        time.sleep(2)

        # Click the "Docs" section tab to filter for document files
        doc_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "docsSection")))
        self.assertTrue(doc_files_button.is_displayed(), "Select docs section button element is visible")

        doc_files_button.click()

        # Wait for the docs table to populate with filtered data
        time.sleep(5)  # Give time for table data to load

        # Locate the table body element
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows to search for our uploaded file
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Search through all rows and columns for the uploaded PDF filename
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_4.pdf":
                    found = True
                    break
            if found:
                break

        # Assert that the uploaded PDF appears in the docs table
        self.assertTrue(found, "Test_4.pdf should be present in the files table.")

        # Brief wait before test completion
        time.sleep(3)
    
    # ----------------- Test Files Slides -----------------
    """This test ensures that an uploaded pptx can be viewed in the Files Menu"""

    def test_file_inclusions_powerpoint_menu(self):
        """
        Test that a PowerPoint (.pptx) file can be uploaded and appears in the Slides section.

        PowerPoint files are categorized separately in the "Slides" section along with
        Google Slides files.

        Verification steps:
        1. Ensure sidebar is expanded
        2. Upload a .pptx file
        3. Send a message referencing the file
        4. Open the View Files menu
        5. Navigate to the "Slides" section
        6. Verify the file appears in the slides table
        """
        
        self.sidebar_press()
        
        time.sleep(3)  # Give time for any UI changes
        
        self.upload_file("Test_5.pptx")
        
        self.send_message("What does this file hold?")
        
        # Click the files inclusion Button
        view_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "viewFiles")))
        self.assertTrue(view_files_button.is_displayed(), "Select Enabled Features Button element is visible")
        
        view_files_button.click()
        
        time.sleep(2)
        
        # View Files Menu appears
        view_files_menu = self.wait.until(EC.presence_of_element_located((By.ID, "viewFilesMenu")))
        self.assertTrue(view_files_menu.is_displayed(), "View Files Menu is visible")
        
        time.sleep(2)
        
        # Click the slide section button
        doc_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "slideSection")))
        self.assertTrue(doc_files_button.is_displayed(), "Select docs section button element is visible")
        
        doc_files_button.click()
        
        # Search through the table for a td element with "Test_5.pptx"
        time.sleep(5)  # Give time for table data to load

        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_5.pptx" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_5.pptx":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_5.pptx should be present in the files table.")

        time.sleep(3)
    
    # ----------------- Test Files Word Docs -----------------
    """Test that Word doc (.docx) appears in the docs section menu"""

    def test_file_inclusions_word_in_doc_menu(self):
        """
        Test that a Word (.docx) file appears in the Docs section.

        This test follows the same pattern as test_file_inclusions_doc_menu:
        - Upload the file
        - Send a message referencing it
        - Navigate to the Docs section of the Files Menu
        - Verify the file is categorized correctly
        """
        
        self.sidebar_press()
        
        time.sleep(3)  # Give time for any UI changes
        
        self.upload_file("Test_6.docx")
        
        self.send_message("What does this file hold?")
        
        # Click the files inclusion Button
        view_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "viewFiles")))
        self.assertTrue(view_files_button.is_displayed(), "Select Enabled Features Button element is visible")
        
        view_files_button.click()
        
        time.sleep(2)
        
        # View Files Menu appears
        view_files_menu = self.wait.until(EC.presence_of_element_located((By.ID, "viewFilesMenu")))
        self.assertTrue(view_files_menu.is_displayed(), "View Files Menu is visible")
        
        time.sleep(2)
        
        # Click the slide section button
        doc_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "docsSection")))
        self.assertTrue(doc_files_button.is_displayed(), "Select docs section button element is visible")
        
        doc_files_button.click()
        
        # Search through the table for a td element with "Test_6.docx"
        time.sleep(5)  # Give time for table data to load

        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_6.docx" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_6.docx":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_6.docx should be present in the files table.")

        time.sleep(3)
        
    # ----------------- Test Files Markdown Docs -----------------
    """Test that Markdown (.md) appears in the docs section menu"""

    def test_file_inclusions_markdown_in_doc_menu(self):
        """
        Test that a Markdown (.md) file appears in the Docs section.

        Follows the standard file upload and verification pattern for document categorization.
        """
        
        self.sidebar_press()
        
        time.sleep(3)  # Give time for any UI changes
        
        self.upload_file("Test_7.md")
        
        self.send_message("What does this file hold?")
        
        # Click the files inclusion Button
        view_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "viewFiles")))
        self.assertTrue(view_files_button.is_displayed(), "Select Enabled Features Button element is visible")
        
        view_files_button.click()
        
        time.sleep(2)
        
        # View Files Menu appears
        view_files_menu = self.wait.until(EC.presence_of_element_located((By.ID, "viewFilesMenu")))
        self.assertTrue(view_files_menu.is_displayed(), "View Files Menu is visible")
        
        time.sleep(2)
        
        # Click the slide section button
        doc_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "docsSection")))
        self.assertTrue(doc_files_button.is_displayed(), "Select docs section button element is visible")
        
        doc_files_button.click()
        
        # Search through the table for a td element with "Test_7.md"
        time.sleep(5)  # Give time for table data to load

        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_7.md" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_7.md":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_7.md should be present in the files table.")

        time.sleep(3)
        
        
        
    # ----------------- Test Files HTML Docs -----------------
    """Test that HTML (.html) appears in the docs section menu"""

    def test_file_inclusions_html_in_doc_menu(self):
        """
        Test that an HTML (.html) file appears in the Docs section.

        Follows the standard file upload and verification pattern for document categorization.
        """
        
        self.sidebar_press()
        
        time.sleep(3)  # Give time for any UI changes
        
        self.upload_file("Test_8.html")
        
        self.send_message("What does this file hold?")
        
        # Click the files inclusion Button
        view_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "viewFiles")))
        self.assertTrue(view_files_button.is_displayed(), "Select Enabled Features Button element is visible")
        
        view_files_button.click()
        
        time.sleep(2)
        
        # View Files Menu appears
        view_files_menu = self.wait.until(EC.presence_of_element_located((By.ID, "viewFilesMenu")))
        self.assertTrue(view_files_menu.is_displayed(), "View Files Menu is visible")
        
        time.sleep(2)
        
        # Click the slide section button
        doc_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "docsSection")))
        self.assertTrue(doc_files_button.is_displayed(), "Select docs section button element is visible")
        
        doc_files_button.click()
        
        # Search through the table for a td element with "Test_8.html"
        time.sleep(5)  # Give time for table data to load

        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_8.html" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_8.html":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_8.html should be present in the files table.")

        time.sleep(3)
        
        
        
    # ----------------- Test Files CSV -----------------
    """Test that CSV appears in the normal section menu but not in docs"""

    def test_file_inclusions_csv_not_in_doc_menu(self):
        """
        Test that a CSV file appears in the main files section but NOT in the Docs section.

        This test verifies proper file categorization:
        1. Upload a .csv file
        2. Verify it appears in the default files table
        3. Navigate to Docs section
        4. Verify it does NOT appear in the Docs section (negative test)

        CSV files are data files and should not be categorized as documents.
        """
        
        self.sidebar_press()
        
        time.sleep(3)  # Give time for any UI changes
        
        self.upload_file("Test_10.csv")
        
        self.send_message("What does this file hold?")
        
        # Click the files inclusion Button
        view_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "viewFiles")))
        self.assertTrue(view_files_button.is_displayed(), "Select Enabled Features Button element is visible")
        
        view_files_button.click()
        
        time.sleep(2)
        
        # View Files Menu appears
        view_files_menu = self.wait.until(EC.presence_of_element_located((By.ID, "viewFilesMenu")))
        self.assertTrue(view_files_menu.is_displayed(), "View Files Menu is visible")
        
        # Search through the table for a td element with "Test_10.csv"
        time.sleep(5)  # Give time for table data to load

        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_10.csv" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_10.csv":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_10.csv should be present in the files table.")

        time.sleep(3)
        
        # Click the slide section button
        doc_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "docsSection")))
        self.assertTrue(doc_files_button.is_displayed(), "Select docs section button element is visible")
        
        doc_files_button.click()
        
        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody[class^='mantine-']")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_10.csv" is not present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_10.csv":
                    found = True
                    break
            if found:
                break

        self.assertFalse(found, "Test_10.csv should not be present in the files table.")


    # File categorization reference for Files Menu:
    # Docs section visibleTypes: ["Word", "PDF", "Markdown", "Text", "HTML"]
    # Slides section visibleTypes: ["PowerPoint", "Google Slides"]
    # Default section: All other file types (CSV, images, etc.)
    
if __name__ == "__main__":
    unittest.main(verbosity=2)