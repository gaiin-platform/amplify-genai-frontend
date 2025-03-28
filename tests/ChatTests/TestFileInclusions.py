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

def load_env():
    # List of possible locations for .env.local
    possible_locations = [
        os.getenv('ENV_FILE'),  # From bash script
        os.path.join(os.path.dirname(__file__), '..', '..', '.env.local'),  # Two levels up
        os.path.join(os.path.dirname(__file__), '..', '.env.local'),  # One level up
        os.path.join(os.path.dirname(__file__), '.env.local'),  # Same directory
    ]

    for location in possible_locations:
        if location and os.path.isfile(location):
            load_dotenv(location)
            # print(f"Loaded environment from: {location}")
            return True
    
    print("Warning: .env.local file not found")
    return False

class FileInclusionTests(unittest.TestCase):
    
    # ----------------- Setup -----------------
    def setUp(self, headless=True):
        
        # Load environment variables from .env.local
        load_env()

        # Get values from environment variables
        base_url = os.getenv("NEXTAUTH_URL", "http://localhost:3000")
        username = os.getenv("SELENIUM_USERNAME", "default_username")
        password = os.getenv("SELENIUM_PASSWORD", "default_password")
        
        # Configure Chrome options based on headless parameter
        options = webdriver.ChromeOptions()
        if headless:
            options.add_argument("--headless")  # Run browser in headless mode
            options.add_argument("--disable-gpu")  # Disable GPU acceleration
            options.add_argument("--window-size=1920,1080")  # Set window size
        
        # Initialize WebDriver with the configured options
        self.driver = webdriver.Chrome(options=options if headless else None)
        self.driver.get(base_url)
        self.wait = WebDriverWait(self.driver, 10)
        self.login(username, password)  # Perform login during setup
        

    def tearDown(self):
        self.driver.quit()
        
    # ----------------- Login -----------------
    def login(self, username, password):
        """Helper method to perform login."""
        try:
            # Click the login button to reveal the login form
            login_button = self.wait.until(EC.element_to_be_clickable(
                (By.ID, "loginButton")
            ))
            login_button.click()

            # Wait for the username and password fields to appear
            username_field = self.wait.until(lambda d: next(
                (e for e in d.find_elements(By.NAME, "username") if e.is_displayed()), None
            ))
            password_field = self.wait.until(lambda d: next(
                (e for e in d.find_elements(By.NAME, "password") if e.is_displayed()), None
            ))

            # Enter username and password
            username_field.send_keys(username)
            password_field.send_keys(password)

            # Submit the login form            
            form = self.driver.find_element(By.TAG_NAME, "form")
            form.submit()
            
            # Add a short delay to wait for the loading screen
            time.sleep(8)  # Wait for 8 seconds before proceeding

            # Wait for a post-login element to ensure login was successful
            self.wait.until(EC.visibility_of_element_located(
                (By.ID, "messageChatInputText")  # Sidebar appears
            ))
        except Exception as e:
            self.fail(f"Login failed: {e}")  
    
    
    
    # ----------------- Setup Test Data ------------------
    def upload_file(self, filename):
        print("Starting upload_file function...")
        if not filename:
            print("Filename is empty or None!")
            return

        file_path = os.path.join(os.path.dirname(__file__), "..", "test_files", filename)
        file_path = os.path.normpath(file_path)
        # print(f"Resolved absolute file path: {file_path}")

        # Ensure the file exists
        if not os.path.exists(file_path):
            print(f"File does NOT exist: {file_path}")
            return
        else:
            print("File exists!")
        
        # print(f"Uploading file: {file_path}")
        
        file_input = self.driver.find_element(By.ID, "__attachFile")
        self.driver.execute_script("arguments[0].classList.remove('sr-only');", file_input)
        self.driver.execute_script("arguments[0].style.display = 'block';", file_input)
        # print("Sending file to input field...")
        file_input.send_keys(file_path)
        time.sleep(15) 
        
    

    def send_message(self, message):
        # Locate the chatbar to input in messageChatInputText
        chat_input_bar = self.wait.until(EC.presence_of_element_located((By.ID, "messageChatInputText")))
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        chat_input_bar.send_keys(message)
        
        time.sleep(2)
        
        # Locate the send message button
        chat_send_message = self.wait.until(EC.presence_of_element_located((By.ID, "sendMessage")))
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        chat_send_message.click()
        time.sleep(30)
        
    
    
    # ----------------- Test Files Inclusion -----------------
    def test_file_inclusions_menu(self):
        
        self.upload_file("Test_3.txt")
        
        self.send_message("What does this file hold?")
        
        # Click the files inclusion Button
        view_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "viewFiles")))
        self.assertTrue(view_files_button.is_displayed(), "Select Enabled Features Button element is visible")
        
        view_files_button.click()
        
        time.sleep(2)
        
        # View Files Menu appears
        view_files_menu = self.wait.until(EC.presence_of_element_located((By.ID, "viewFilesMenu")))
        self.assertTrue(view_files_menu.is_displayed(), "View Files Menu is visible")
        
        # Search through the table for a td element with "Text_3.txt"
        time.sleep(2)  # Give time for table data to load

        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody.mantine-yzu17x")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_3.txt" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_3.txt":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_3.txt should be present in the files table.")

        time.sleep(3)
        
    
    
    # ----------------- Test Files Docs -----------------
    def test_file_inclusions_doc_menu(self):
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[0].click()
        
        time.sleep(3)  # Give time for any UI changes
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[-1].click()
        
        time.sleep(3)  # Give time for any UI changes
        
        self.upload_file("Test_4.pdf")
        
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
        
        # Click the docs section button
        doc_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "docsSection")))
        self.assertTrue(doc_files_button.is_displayed(), "Select docs section button element is visible")
        
        doc_files_button.click()
        
        # Search through the table for a td element with "Text_3.txt"
        time.sleep(5)  # Give time for table data to load

        # Locate the table body
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody.mantine-yzu17x")))

        # Get all table rows
        rows = table_body.find_elements(By.TAG_NAME, "tr")

        # Check if "Test_4.txt" is present in any of the rows
        found = False
        for row in rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            for column in columns:
                if column.text.strip() == "Test_4.pdf":
                    found = True
                    break
            if found:
                break

        self.assertTrue(found, "Test_4.pdf should be present in the files table.")

        time.sleep(3)
    
    
    
    # ----------------- Test Files Slides -----------------
    def test_file_inclusions_doc_menu(self):
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[0].click()
        
        time.sleep(3)  # Give time for any UI changes
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[-1].click()
        
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
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody.mantine-yzu17x")))

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
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[0].click()
        
        time.sleep(3)  # Give time for any UI changes
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[-1].click()
        
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
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody.mantine-yzu17x")))

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
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[0].click()
        
        time.sleep(3)  # Give time for any UI changes
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[-1].click()
        
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
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody.mantine-yzu17x")))

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
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[0].click()
        
        time.sleep(3)  # Give time for any UI changes
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[-1].click()
        
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
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody.mantine-yzu17x")))

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
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[0].click()
        
        time.sleep(3)  # Give time for any UI changes
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[-1].click()
        
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
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody.mantine-yzu17x")))

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
        table_body = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "tbody.mantine-yzu17x")))

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
    
    
    # visibleTypes={["Word", "PDF", "Markdown", "Text", "HTML"]}
    # visibleTypes={["PowerPoint", "Google Slides"]}
    
    
    
if __name__ == "__main__":
    unittest.main(verbosity=2)