# Lab Scheduler Project Documentation

## Table of Contents

* [Project Overview](#project-overview)
* [Technical Stack](#technical-stack)
  * [Frontend](#frontend)
  * [Backend](#backend)
* [Main Features](#main-features)
  * [User Side](#user-side)
  * [Admin Side](#admin-side)
* [Project Structure](#project-structure)
* [Database Structure](#database-structure)
  * [User Table](#user-table)
  * [Device Table](#device-table)
  * [Booking Table](#booking-table)
* [Schemas Overview](#schemas-overview)
* [User Guide](#user-guide)
  * [User Functions](#user-functions)
  * [Admin Functions](#admin-functions)
  * [Multi-Device Booking for Users](#multi-device-booking-for-users)
* [Frontend Components Overview](#frontend-components-overview)
  * [User Interface Components](#user-interface-components)
  * [Admin Interface Components](#admin-interface-components)
* [Key API Explanations](#key-api-explanations)
  * [User APIs](#user-apis)
  * [Admin APIs](#admin-apis)
* [Discord Notifications](#discord-notifications)
* [PDU Control Panel](#PDU-Control-Panel)
   * [PDU Management](#pdu-management)
   * [Backend API Endpoints](#backend-api-endpoints)
   * [Configuration Example](#configuration-example)
* [Troubleshooting](#troubleshooting)

## Project Overview

Lab Scheduler is a comprehensive equipment reservation management system designed specifically for the Open Ireland Testbed. Researchers and administrators can easily reserve and manage lab equipment through this system.

## Technical Stack

### [Frontend Technologies](#frontend-technologies)

* **React.js**: For building user interfaces.
* **Tailwind CSS** & **Custom CSS**: Managing page styles.
* **Darkreader**: Supports switching between light and dark modes.
* **Fuse.js**: Implementing fuzzy search capabilities for device selection.
* **Dayjs**: Handling date and time manipulation.

### [Backend Technologies](#backend-technologies)

* **FastAPI**: Provides RESTful APIs.
* **SQLAlchemy**: ORM database operations.
* **bcrypt & Passlib**: Password security management.
* **MySQL**: Relational database storage.
* **Docker Compose**: Containerized deployment.
* **Discord Webhooks**: Sending notifications for booking actions and administrative decisions.

## Main Features

### [User Side](#user-side)

- 🔗 Open this link through VPN: http://100.111.63.95:3000/client
- ✅ User registration/login
- 🗓️ Single/Multi-device booking with conflict detection
- 📋 Personal booking record management
- ⚠️ Automated conflict alerts with resolution suggestions
- 🚀 Quickly go to admin side

### [Admin Side](#admin-side)

- 🔗 Open this link through VPN: http://100.111.63.95:3000/admin
- 🔐 Admin authentication with secret key
- 🖥️ Device lifecycle management (CRUD operations)
- 📊 Booking approval/rejection dashboard
- 🔍 Full booking history with advanced filters
- 🚀 Quickly go to user side

<span style="color:red;">**NB:**</span>
1. Need to confirm the role before use.
2. Adminstrators do not need to re-register when sign in the user side.


## Project Structure

```
scheduler_internship/
├── backend/
│   ├── admin.py
│   ├── database.py
│   ├── DeviceTable-Sheet1.csv
│   ├── discord_utils.py
│   ├── Dockerfile
│   ├── email_utils.py
│   ├── hash.py
│   ├── load_devices.py
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   ├── reset_table.py
│   └── schemas.py
├── frontend/
│   ├── node_modules/
│   ├── public/
│   └── src/
│       ├── admin/
│       │   ├── admin.css
│       │   ├── admin.js
│       │   ├── adminLogin.js
│       │   ├── AdminScheduleTable.js
│       │   ├── ManageDevices.js
│       │   ├── PduControlPanel.js
│       │   ├── PendingApprovalsList.js
│       │   └── simpleControlPanel.css
│       ├── client/
│       │   ├── BookingAllDay.css
│       │   ├── BookingAllDay.js
│       │   ├── BookingService.js
│       │   ├── client.js
│       │   ├── LoginRegisterPopup.js
│       │   ├── ManageBookings.js
│       │   ├── ScheduleSummary.js
│       │   └── ScheduleTable.js
│       ├── image/
│       ├── App.css
│       ├── App.js
│       ├── App.test.js
│       ├── eventBus.js
│       ├── index.css
│       ├── index.js
│       ├── logo.svg
│       ├── reportWebVitals.js
│       └── setupTests.js
├── docker-compose.yml
├── .env
├── .gitignore
└── README.md
```

## Database Structure

### [User Table](#user-table)

* `id`: User ID (Primary Key)
* `username`: Username (Unique)
* `email`: Email address
* `password`: Password (hashed)
* `is_admin`: Boolean flag indicating administrative privileges
* `discord_id`: Discord user ID for notifications

### [Device Table](#device-table)

* `id`: Device ID (Primary Key)
* `deviceType`: Type of device
* `deviceName`: Name of the device
* `ip_address`: IP address
* `status`: Device status (Available/Maintenance)
* `maintenance_start`: Maintenance start time
* `maintenance_end`: Maintenance end time
* `Out_Port`: Outgoing port number
* `In_Port`: Incoming port number

### [Booking Table](#booking-table)

* `booking_id`: Booking ID (Primary Key)
* `device_id`: Associated device ID (Foreign Key)
* `user_id`: Associated user ID (Foreign Key)
* `start_time`: Start time of booking
* `end_time`: End time of booking
* `status`: Booking status (Pending, Confirmed, Cancelled, etc.)
* `comment`: Optional comment or notes

## Schemas Overview

Schemas (`schemas.py`) are defined using Pydantic models for validating request and response data:

* **User schemas**: Handle user registration and login data.
* **Booking schemas**: Define the structure of booking data submitted by users.
* **Device schemas**: Validate and structure data related to devices managed by admins.
* **Admin schemas**: Specialized schemas used specifically for admin actions, such as device management and booking approvals.

## User Guide

### [User Functions](#user-functions)

1. **Registration (New Users)**

   **Step 1: Access Registration Page**
      * Click **user icon**(top-right corner)
      * Click "**No account? Register Now**"

   **Step 2: Complete Registration Form**
      * User name
      * Email
      * Discord Id
      * Password(Min. 8 chars)
   
   **Step 3: Submit**
      * Click the **Complete** button
      * Systey displays: **Register successfully**

   <span style="color:red;">**Tips: How to Get Your own Discord Id**</span> 
   * **Open User Settings**: 
   
      ➜ Click your profile picture in the bottom-left corner > Select "User Settings" (⚙️ icon).
   
   * **Enable Developer Mode**

      ➜ Navigate to "Advanced" in the left menu (or type "Advanced" in the top search bar).

      ➜ Toggle the "Developer Mode" switch to ON ✅.
   
   * **Copy Your User ID**
      
      ➜ Return to the main Discord window.
      ➜ Right-click your profile picture in the bottom-left corner.
      ➜ Select "Copy User ID"

   * **Paste Your ID**

      ➜ Go to your registration page/form.
      ➜ Paste the ID

2. **Login(Existing Users)**

   **Step 1: Access Login Page**
      * Click **user icon**(top-right corner)
   
   **Step 2: Input Required Information**
      * User Name
      * Password (You have to remember)

3. **Booking Devices**

   **Way 1**: Booking Single or Multidevice using Schedule Table
      * **Seletct Expected Devices**

         ➜ Use the mouse to scroll through the schedule table or search for the device you want to schedule directly at the top.
      
      * **Set and Adjust the Start & End Time**

         1. First click on a time slot to set the start time.
         
         2. Move the cursor to another slot then click it to specify the end time. 
           Don't need to hold the mouse button while moving and can select consecutive time periods across multiple weeks.
         
         3. Move the cursor to a time slot that you want to disgard, the time slot will be removed after left-clicking it. However, you can only cancel a single time slot at a time, so choose the time slots carefully.
        
         4. All booking information will clearly show in the right Summary panel.

      * **Submit & Leave Message(Optional)**

         ✅ Submission Process

         1. Verify all reservation details are correct.

         2. Click the Submit button (lower-right corner)
         
         3. A confirmation prompt will pop up. 
            * Click ```OK``` to confirm the submission.
            * Auto-send booking details to Discord channel.
            * Wait the results from adminstrators.
         
         🚫 Cancel Submission
         * Click the ```Cancel``` in confirmation prompt

         💬 Optional Message to Admins

         * Add notes in the "Message" field before clicking Submit
         * Supports emojis 😊

   **Way 2**: [Quickly Booking Multiple Devices using Multi-device Booking Functionality](#multi-device-booking-for-users)
   
   <span style="color:red;">**NB:**</span> 
   * The status of time slots will be updated in schedule table.
   * The name of the user who reserved the time slot will be displayed above it.
   * The time period during maintenance cannot be selected.
   * Users cannot select booked time slots by themselves.

3. **View and Cancel Booking Records**:

   * Click **```Records```** to review current and past bookings.
   * Click **```CANCEL```** or **```DELETE```** buttons in action column to manage those bookings.
   * **```PENDING```** and **```CONFIRMED```** bookings can be canceled.
   * **```CANCELLED```** and **```EXPIRED```** bookings can be deleted.

4. **Conflict Detection**:

   * Automatic detection of booking conflicts.

   <span style="color:red;">**NB:**</span>  
   The maximum number of users allowed to use the same device at the same time is 2.<sup>[1]</sup>


### [Admin Functions](#admin-functions)

1. **Admin Registration and Login**:

   * Register with a special admin secret.
   * Log in to access admin-specific features.

2. **Device Management**:

   * Add new devices.
   * Edit existing device details such as devices' type, name, ip address and so on.
   * Delete devices as required.

   <span style="color:red;">**NB:**</span>  
   
   When administrators select maintenance periods for devices, they can choose from three predefined time slots:
   * ```7 AM - 12 PM```
   * ```12 AM - 6 PM```
   * ```6 PM - 11 PM```

   For easier management and clarity in scheduling, the frontend schedule table automatically adjusts the display of the ```6 PM - 11 PM``` slot to represent a cross-day interval:
   * Data will be stored in this format: ```6 PM - 11 PM/YYYY-MM-DD```
   * Schedule table in frontend will be displayed as ```6 PM - 7 AM```, clearly indicating that the maintenance period extends from 6 PM of the selected day to 7 AM of the following day.


3. **Booking Management**:

   * Approve or reject user booking requests.
   * Resolve booking conflicts. 
   * Notifications will be sent to Discord channels automatically.
   
   <span style="color:red;">**NB:**</span> 
   
   **The maximum number of user allowed to use the same device at the same time is 2.**<sup>[1]</sup>

4. **View All Bookings**:

   * Access a comprehensive list of all booking records.

### [Multi-Device Booking for Users](#multi-device-booking-for-users)

1. **Access Multi-Device Booking**:

   * Click the "Multi-Device Booking" button on the homepage.

2. **Device Selection**:

   * Enter device names, types, or IP addresses in the search box.
   * Use comma, semicolon, or newline to separate multiple entries.
   * Click "OK" to display available devices matching the search criteria.

3. **Select Devices and Dates**:

   * Select desired devices from the filtered results, then those devices will appear a specific place under the search box.
   * Choose start and end dates from the date picker.
   * If the required content are not completed, it will show warning when click save button.

4. **Check for Conflicts**:

   * Conflicts are automatically detected and displayed.
   * Adjust your selection based on the highlighted conflicts.

5. **Save Booking**:

   * Click the "Save" button or press Enter to finalize your multi-device booking.

## Frontend Components Overview

The frontend of Lab Scheduler is designed with user-friendly, modular React components tailored specifically to user and admin interfaces. Here's an in-depth explanation of each key component and its purpose:

### [User Interface Components](#user-interface-components)

#### 1. Client Page (`Client.js`)
**Purpose:** Main interface for regular users to book devices, view booking schedules, manage reservations, and toggle display modes 

**Key Elements:**
* **`Calendar`**: Date selection with single-day or range selection
* **`Schedule Table`**: Displays device availability and allows time slot selection
* **`Schedule Summary`**: Provides a concise overview of selected bookings
* **`Reservation Management`**: Interface to manage existing bookings
* **`Multi-Device Booking`**: Button to launch the multi-device booking interface
* **`Dark Mode Toggle`**: Allows users to switch between light and dark themes

#### 2. Login/Register Popup (`LoginRegisterPopup.js`)
**Purpose:** Manages user authentication through login and registration  
**Key Elements:**
* **`Login Form`**: User credential submission
* **`Registration Form`**: New user account creation with password confirmation
* **`Password Visibility Toggle`**: Allows users to securely show or hide passwords

#### 3. Multi-Device Booking (`BookingAllDay.js`)
**Purpose:** Enables booking multiple devices simultaneously across entire days or specific time slots  
**Key Elements:**
* **`Device Search`**: Fuzzy search via Fuse.js to quickly find devices
* **`Conflict Detection`**: Automatically detects and displays booking conflicts or maintenance periods
* **`Date Picker`**: Selection of booking date ranges
* **`Conflict List`**: Clearly shows conflicting bookings with details and types

#### 4. Schedule Table (`ScheduleTable.js`)
**Purpose:** Visual representation of device schedules to facilitate booking  
**Key Elements:**
* **`Week Navigation`**: Navigate through different weeks easily
* **`Device Status Visualization`**: Indicates availability, maintenance, and booking conflicts clearly
* **`Interactive Booking Slots`**: Clickable slots for users to quickly make or cancel reservations

#### 5. Schedule Summary (`ScheduleSummary.js`)
**Purpose:** Summarizes user's current selection of bookings  
**Key Elements:**
* **`Merged Interval Display`**: Concisely combines consecutive booking intervals for readability
* **`Conflict Highlighting`**: Clearly marks conflicting booking intervals

### [Admin Interface Components](#admin-interface-components)

#### 1. Admin Page (`admin.js`)
**Purpose:** Main portal for administrators, providing comprehensive management of devices, bookings, and user accounts  
**Key Elements:**
* **`Device Management`**: Comprehensive device creation, editing, and deletion
* **`Booking Management`**: Approval or rejection of booking requests and conflict resolution

#### 2. Admin Login (`adminLogin.js`)
**Purpose:** Secure admin authentication interface requiring specific admin credentials  
**Key Elements:**
* **`Secure Authentication`**: Uses a special admin secret for enhanced security

#### 3. Manage Devices (`ManageDevices.js`)
**Purpose:** Interface for adding, editing, and removing lab equipment  
**Key Elements:**
* **`Device Table`**: Lists devices with full details, easy editing, and deletion controls
* **`Device Search`**: Real-time search capability for efficient management

#### 4. Pending Approvals (`PendingApprovalsList.js`)
**Purpose:** Lists all booking requests that require admin intervention  
**Key Elements:**
* **`Booking Approval/Rejection`**: Quick actions to resolve pending or conflicting bookings

#### 5. Admin Schedule Table (`AdminScheduleTable.js`)
**Purpose:** Visual schedule of all devices, booking statuses, and conflicts from the admin's perspective  
**Key Elements:**
* **`Comprehensive Booking Overview`**: Displays all bookings, statuses, and conflicts clearly
* **`Interactive Conflict Resolution`**: Enables direct intervention to manage and resolve booking conflicts

#### 6. Manage Bookings (`ManageBookings.js`)
**Purpose:** Allows administrators to view and manage existing bookings comprehensively  
**Key Elements:**
* **`Booking Record Table`**: Lists bookings with detailed information, filtering, and search functionalities

## Key API Explanations

### [User APIs](#user-apis)

* **`POST /users/register`**: User registration, returns user details.
* **`POST /login`**: User login, returns login status and user ID.
* **`POST /bookings`**: Book devices, requires booking details, returns booking confirmation.
* **`PUT /bookings/{booking_id}/cancel`**: Cancel booking, requires booking ID, returns cancellation confirmation.
* **`GET /bookings/user/{user_id}`**: Get all user bookings, returns booking details.

### [Admin APIs](#admin-apis)

* **`POST /admin/register`**: Admin registration, requires admin secret, returns admin user details.
* **`POST /admin/login`**: Admin login, returns admin status.
* **`POST /admin/devices`**: Add new device, requires device details, returns created device.
* **`PUT /admin/devices/{device_id}`**: Edit device, requires device ID and details, returns updated device.
* **`DELETE /admin/devices/{device_id}`**: Delete device, requires device ID, returns deletion confirmation.
* **`GET /admin/bookings/all`**: View all bookings, returns detailed booking list.
* **`PUT /admin/bookings/{booking_id}`**: Approve or reject bookings, requires booking ID and status, returns status update confirmation.

## [Discord Notifications](#discord-notifications)

Notifications sent via Discord Webhooks:

* **Booking Created Notification**: When a booking is created.
* **Admin Action Notification**: Admin booking decisions, mentioning the user via Discord ID.

## [PDU Control Panel](#PDU-Control-Panel)

The PDU (Power Distribution Unit) Control Panel is a comprehensive interface for managing power distribution units connected with testbed. It allows administrators to monitor, control, and manage PDUs, including viewing sensor data, controlling power outlets, and configuring PDU devices. The system integrates with Raritan PDU devices and provides a user-friendly React frontend with a FastAPI backend for seamless management.

### [PDU Management](#pdu-management)
   * 🖥️ Add, delete, and configure PDU devices
   * 🔌 Connect to and disconnect from PDUs 
   * 🌡️ Monitor sensor data (temperature, humidity, power)
   * ⚡ Control power outlets (turn on/off)
   * 📊 View system statistics (total PDUs, connected PDUs, average temperature, total power)
   * 📋 Show which devices are connected to the outlets for each PDU

### [Backend API Endpoints](#backend-api-endpoints)

#### PDU Management APIs
   * GET /control-panel/pdus: Get list of all PDUs
   * POST /control-panel/pdus: Add a new PDU
   * GET /control-panel/pdus/{pdu_name}: Get details of a specific PDU
   * DELETE /control-panel/pdus/{pdu_name}: Delete a PDU
   * POST /control-panel/pdus/{pdu_name}/connect: Connect to a PDU
#### Sensor and Outlet APIs
   * GET /control-panel/pdus/{pdu_name}/sensors: Get sensor data (temperature, humidity, power)
   * GET /control-panel/pdus/{pdu_name}/outlets: Get list of outlets
   * POST /control-panel/pdus/{pdu_name}/outlets/{outlet_idx}/control: Control an outlet (on/off)
#### System Status API
   * GET /control-panel/status: Get system-wide statistics (total PDUs, connected PDUs, etc.)

### [Configuration Example](#configuration-example)

PDU Configuration Format (config.yaml)

```
pdus:
- connected: true
  external_id: PDU_ONE
  host: 10.10.10.171
  humidity: null
  last_updated: '2025-07-02T12:29:06.737016'
  name: PDU1
  outlets:
  - device_ip: 10.10.10.202
    mode: scheduled
    outlet_idx: 7
  - outlet_idx: 1
    status: 'off'
  - outlet_idx: 2
    status: 'on'
  passwd: password
  pdu_path: /model/pdu/0
  power: 0.0
  sensors:
  - slot_idx: 0
  temperature: 26.0
  user: admin
- connected: true
  external_id: PDU_TWO
  host: 10.10.10.172
  humidity: 30.91
  last_updated: '2025-07-02T12:29:07.958273'
  name: PDU2
  outlets:
  - device_ip: 10.10.10.203
    mode: always_on
    outlet_idx: 3
  - outlet_idx: 1
    status: 'on'
  passwd: password
  pdu_path: /model/pdu/0
  power: 1189.0
  sensors:
  - slot_idx: 0
  temperature: 29.0
  user: admin
- connected: true
  external_id: PDU_THREE
  host: 10.10.10.173
  humidity: null
  last_updated: '2025-07-02T12:29:08.517484'
  name: PDU3
  outlets: []
  passwd: password
  pdu_path: /model/pdu/0
  power: 1713.0
  sensors:
  - slot_idx: 0
  temperature: 27.75
  user: admin
```


## Troubleshooting

* Verify database and Discord webhook configurations if issues arise.

## Testing

The project includes a comprehensive test suite for both backend and frontend.

### Running Tests

**Recommended: Docker-based testing**
```bash
./run-tests-docker.sh
```

This runs all tests in isolated Docker containers with all dependencies pre-installed.

For more details, see [TESTING.md](TESTING.md).

### Continuous Integration

Tests automatically run on GitHub Actions for:
- Push to `main`, `develop`, or `master` branches
- Pull requests to `main`, `develop`, or `master` branches

See `.github/workflows/tests.yml` for the CI configuration.

---

For further technical support or feature requests, please contact the project development team.

<sup>[1]</sup> For example, when User B attempts to book a device and time slot already reserved by User A, the system identifies the overlap as a conflict and flags User B’s submission. Despite the conflict warning, User B can forcibly submit their request, which leaves both bookings in a pending state without overriding User A’s original reservation. Administrators then review both submissions independently, with authority to approve or reject either request based on priority, timing, or organizational policies, ensuring final allocations are unambiguous and auditable.