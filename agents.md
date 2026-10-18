# AGENTS.md — Personal Finance Tracker

## 1. Project Overview

Build a personal finance tracking web application that allows the user to manage their money, record income and expenses, organize transactions by category, and track savings.

The application must be simple, responsive, secure, and easy to maintain.

### Main Goals

- Let users set their initial balance.
- Record income and expenses.
- Automatically calculate the available balance.
- Organize transactions into separate category pages.
- Provide a dedicated savings page.
- Store user data in Supabase.
- Allow users to access their financial records after logging in.
- Ensure transaction edits and deletions correctly update financial summaries.

This is a personal finance tracker. Do not integrate with GoPay or any other financial service.

## 2. Technology Stack

Use only the following technologies:

- HTML5
- CSS3
- Vanilla JavaScript (ES modules)
- Supabase Authentication
- Supabase PostgreSQL Database
- Supabase Row Level Security (RLS)
- Lucide Icons through an approved browser-compatible integration, if needed

### Strict Restrictions

- Do not use Next.js.
- Do not use React, Vue, Angular, Svelte, or other frontend frameworks.
- Do not use TypeScript.
- Do not introduce a Node.js backend unless explicitly requested.
- Do not use a mock backend as the final implementation.
- Do not store financial records permanently in localStorage.
- Do not use GoPay APIs, scraping, or unofficial financial integrations.
- Do not add unnecessary libraries or dependencies.

Use standard HTML, CSS, and JavaScript that can run through a local development server.

## 3. Suggested Project Structure

Organize the project using the following structure:

```text
finance-app/
├── index.html
├── login.html
├── register.html
├── transactions.html
├── category.html
├── savings.html
├── settings.html
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   ├── dashboard.css
│   │   └── responsive.css
│   ├── js/
│   │   ├── config.js
│   │   ├── supabase.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── transactions.js
│   │   ├── categories.js
│   │   ├── savings.js
│   │   ├── settings.js
│   │   └── utils.js
│   └── icons/
├── supabase/
│   └── schema.sql
├── .env.example
├── .gitignore
└── AGENTS.md
```

Adjust this structure only when there is a clear technical reason.

Do not create empty files that serve no purpose. Keep scripts separated by responsibility and avoid duplicating business logic.

## 4. Application Pages

### 4.1 Dashboard

Display:

- Current available balance.
- Total income.
- Total expenses.
- Current savings balance.
- Expense summaries by category.
- Recent transactions.
- A button to add a transaction.
- A clear empty state when no transactions exist.

All financial values must come from the authenticated user's Supabase records.

### 4.2 Transactions

Provide:

- Transaction history.
- Search by description.
- Filters by category, type, and date.
- Add transaction functionality.
- Edit transaction functionality.
- Delete transaction functionality.
- Correct recalculation after every change.

Each transaction must contain a description, amount, type, category, and transaction date.

### 4.3 Category Pages

Provide separate views for:

- Makan
- Nabung
- Transportasi
- Kuliah
- Belanja
- Lainnya

Users should also be able to create additional categories.

Each category page must display its transaction history, total amount, and relevant summaries.

Category names must not be hardcoded throughout the application. Store and retrieve categories from the database.

### 4.4 Savings

Provide:

- Total savings balance.
- Savings history.
- Add money to savings.
- Withdraw money from savings.
- Savings transaction descriptions and dates.

Moving money into savings is an internal transfer, not a consumption expense.

### 4.5 Authentication

Provide:

- Registration.
- Login.
- Logout.
- Session persistence through Supabase Auth.
- Protected application pages.
- Clear feedback for authentication errors.

Unauthenticated users must not be able to access private financial data.

### 4.6 Settings

Allow the user to:

- View their account information.
- Configure their initial balance when permitted.
- Manage categories.
- Log out.

Do not allow changing the initial balance to silently overwrite transaction history or create an inconsistent balance.

## 5. Financial Rules

Financial calculations must be consistent across all pages.

### Transaction Types

Use these transaction types:

- `income`: money received.
- `expense`: money spent on goods or services.
- `save`: money moved into savings.
- `unsave`: money withdrawn from savings into available funds.

All transaction amounts must be positive integer values representing Indonesian rupiah.

Never use floating-point calculations for storing rupiah amounts.

### Available Balance

Calculate:

`Available Balance = Initial Balance + Total Income - Total Expenses - Total Savings Contributions + Total Savings Withdrawals`

### Savings Balance

Calculate:

`Savings Balance = Total Savings Contributions - Total Savings Withdrawals`

### Total Expenses

Only transactions of type `expense` count as consumption expenses.

Savings contributions must not be included in total expenses.

### Validation Rules

- Transaction amount must be greater than zero.
- Descriptions must not contain only whitespace.
- Categories must belong to the authenticated user.
- Users must not spend or save more than their available balance.
- Savings withdrawals must not exceed the available savings balance.
- Reject invalid dates and malformed inputs.
- Do not trust calculations performed exclusively in the browser.

### Editing and Deleting

When a transaction is edited or deleted, financial summaries must be recalculated from the persisted records.

Do not apply a balance adjustment twice.

When an operation fails, do not show a success message or update the UI as if the database change succeeded.

## 6. Supabase Database

Use Supabase PostgreSQL as the persistent data store.

The database should include tables for:

- `profiles`
- `categories`
- `transactions`

A profile stores the user's initial balance and account-related preferences.

A category belongs to a specific user.

A transaction belongs to a specific user and references a category owned by that same user.

Use UUID identifiers and appropriate foreign keys.

Use database constraints for:

- Valid transaction types.
- Positive amounts.
- Required fields.
- Valid relationships between users, categories, and transactions.

Create indexes for commonly queried fields, especially user IDs and transaction dates.

Use database migrations or a version-controlled SQL schema to track changes.

Do not assume that frontend validation alone provides data integrity.

## 7. Security Requirements

Security is mandatory.

### Row Level Security

Enable RLS on every table containing user-specific information.

Create policies that restrict each authenticated user to their own records.

Policies must cover all permitted operations:

- SELECT
- INSERT
- UPDATE
- DELETE

Use `auth.uid()` to verify ownership.

Ensure that category ownership is validated when a transaction is created or modified.

Do not rely only on hidden UI elements or frontend route checks.

### API Keys

Use the Supabase publishable key in browser code only as intended by Supabase.

Never expose:

- Supabase secret keys.
- Legacy `service_role` keys.
- Database passwords.
- Private API credentials.
- Authentication tokens belonging to another user.

Never commit real credentials to GitHub.

Provide `.env.example` with placeholder values only.

If frontend environment variables are required by the chosen development server, document how to configure them. Do not assume that a static HTML file automatically supports `.env` files.

### Authentication

Use Supabase Auth for identity and sessions.

Do not implement custom password storage.

Do not log passwords, access tokens, refresh tokens, or sensitive financial information.

Do not bypass RLS to simplify frontend development.

### Database Integrity

For financial operations that modify multiple related records, use a secure database transaction or an appropriate PostgreSQL function.

If using PostgreSQL functions, validate the authenticated user and all balances inside the database transaction.

Never allow a browser client to execute privileged financial operations without proper authorization and validation.

## 8. UI and Design Guidelines

Use a clean, minimal, dark interface.

### Design Direction

- Primary background: near-black.
- Card backgrounds: dark gray.
- Primary accent: muted emerald green.
- Main text: off-white.
- Secondary text: neutral gray.
- Positive values: green or blue.
- Expenses: neutral white or muted red.
- Rounded cards with subtle borders.
- Consistent spacing and typography.
- Avoid excessive gradients, glowing effects, and decorative elements.

### Layout

Desktop:

- Sidebar navigation.
- Main dashboard content.
- Summary cards.
- Category summaries.
- Recent transaction list.

Mobile:

- Responsive content layout.
- Readable financial amounts.
- Touch-friendly buttons.
- Responsive transaction forms.
- Navigation adapted to small screens.

### Usability

- Provide loading states.
- Provide empty states.
- Provide error messages.
- Confirm destructive actions.
- Show success feedback after confirmed database operations.
- Use accessible labels and keyboard-friendly controls.
- Format currency using Indonesian rupiah conventions.

Do not display fake financial data as if it were real user data.

If demo data is needed, clearly label it as demo data.

## 9. JavaScript Architecture

Use ES modules and separate code by responsibility.

- `supabase.js`: initialize the Supabase client.
- `auth.js`: login, registration, logout, and session handling.
- `dashboard.js`: fetch and render financial summaries.
- `transactions.js`: transaction CRUD operations.
- `categories.js`: category management and category views.
- `savings.js`: savings history and savings operations.
- `settings.js`: profile and initial balance settings.
- `utils.js`: currency formatting, validation, and shared helpers.

Avoid duplicating balance calculation logic across multiple pages.

Prefer reusable functions for:

- Fetching authenticated user information.
- Loading transactions.
- Formatting rupiah.
- Validating forms.
- Rendering transaction lists.
- Displaying errors.
- Refreshing financial summaries.

Keep DOM manipulation understandable and avoid unnecessary global variables.

## 10. Development Workflow

Before implementing changes:

1. Inspect the existing project files.
2. Identify the current structure and dependencies.
3. Read the existing SQL schema and configuration.
4. Preserve working features.
5. Make the smallest coherent change necessary.

When implementing features:

1. Define the expected behavior.
2. Implement database changes first when required.
3. Implement the JavaScript logic.
4. Connect the UI.
5. Validate error handling and authorization.
6. Test the affected functionality.

Do not replace an entire working application just to make a small change.

Do not claim a feature is complete without checking the relevant code and testing it when possible.

## 11. Testing Checklist

Verify the following before considering the application complete:

- Users can register and log in.
- Users can log out.
- Sessions persist correctly.
- Users cannot access another user's financial records.
- Initial balance is saved and loaded correctly.
- Income increases available balance.
- Expenses decrease available balance.
- Savings contributions decrease available balance.
- Savings withdrawals increase available balance.
- Savings balance is calculated correctly.
- Editing a transaction updates summaries correctly.
- Deleting a transaction updates summaries correctly.
- Invalid amounts are rejected.
- Categories cannot be used across different users.
- Database failures do not produce false success messages.
- The UI works on mobile and desktop.
- No secret keys are exposed in browser code or version control.

## 12. Working Principles

- Prioritize correctness, security, and maintainability.
- Build features incrementally.
- Do not invent undocumented API endpoints.
- Do not introduce unnecessary dependencies.
- Do not add unrelated features without approval.
- Explain important database changes.
- Provide complete, usable code rather than incomplete snippets when asked to implement a feature.
- State clearly when a feature requires additional configuration.
- Ask for clarification when a financial rule is ambiguous and cannot safely be inferred.

## Final Objective

Deliver a functional, secure personal finance web application using HTML, CSS, vanilla JavaScript, and Supabase.

The application must allow the user to record their finances, see their available balance update correctly, manage categories independently, and access their own saved records securely from different devices.