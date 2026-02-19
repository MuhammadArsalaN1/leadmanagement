Lead Management System

A modern Lead Management System built with React and Firebase to manage sales conversations, follow-ups, and order tracking. The system provides a real-time dashboard, lead pipeline, activity tracking, and follow-up management for sales teams and agencies.

Overview

This application helps users track leads from initial conversation to order delivery. It includes a smart dashboard with real-time updates, lead scoring, follow-up alerts, and a visual sales pipeline to improve productivity and conversion rates.

Core Features

Real-time lead management using Firebase Firestore

Status-based lead lifecycle (Still in Talk, Pending, Order Placed, Order Delivered, Cancelled)

Smart follow-up tracking with overdue and today alerts

Sales pipeline view for visual lead progression

Lead scoring and health indicators

Activity timeline for each lead

Comments and follow-up scheduling

WhatsApp quick contact integration

Secure protected routes for authenticated users

Responsive and space-optimized dashboard UI

Dashboard Highlights

Summary metrics (Total Leads, Active Leads, Urgent Leads)

Urgent follow-up alerts

Today’s follow-ups and overdue follow-ups panel

Table view and pipeline view switching

Inline lead editing and status updates

Todo board for daily task management

Tech Stack

Frontend: React (Vite)

Backend: Firebase

Database: Firebase Firestore

Authentication: Firebase Auth

Styling: Inline CSS (custom responsive system)

Project Structure
vite-project/
├── src/

│   ├── assets/

│   ├── components/

│   │   ├── AddLead.jsx

│   │   ├── EditLead.jsx

│   │   ├── LeadTable.jsx

│   │   ├── ProtectedRoute.jsx

│   │   └── TodoBoard.jsx

│   ├── pages/

│   │   ├── Dashboard.jsx

│   │   └── Login.jsx

│   ├── firebase/

│   │   └── firebase.js

│   ├── utils/

│   │   └── todoRollover.js

│   ├── App.jsx

│   └── main.jsx

├── public/

├── .env

├── package.json

└── README.md


Installation & Setup

Clone the repository:
git clone https://github.com/MuhammadArsalaN1/leadmanagement.git


Navigate to the project:
cd leadmanagement

Install dependencies:
npm install


Add Firebase environment variables in .env:

VITE_FIREBASE_API_KEY=your_key

VITE_FIREBASE_AUTH_DOMAIN=your_domain

VITE_FIREBASE_PROJECT_ID=your_project_id

VITE_FIREBASE_STORAGE_BUCKET=your_bucket

VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id

VITE_FIREBASE_APP_ID=your_app_id


Run the project:
npm run dev
Firebase Collections
leads
fullName
cell
status
followUpAt
comments[]
activity[]
updatedAt
Future Enhancements
Role-based access (Admin / Sales Agent)
Advanced analytics and reporting
Automated reminders and notifications
Export leads to CSV
CRM integrations

License

This project is open-source and available under the MIT License.
Author

Muhammad Arsalan
GitHub: https://github.com/MuhammadArsalaN1
