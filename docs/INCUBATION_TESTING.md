# Incubation demo walkthrough

Run `npm run dev` from the repository and open [Demo accounts](http://127.0.0.1:5173/demo). If Vite is running on a different port, use the URL it prints. Open `/demo` on that same address each time you switch roles. Each browser profile and each website address, including a different local port or a hosted deployment, has its own demo records. Use fictional information and a dummy PDF for agreement testing. Demo fees are in Kenyan shillings.

| Role                      | Demo login                           |
| ------------------------- | ------------------------------------ |
| Individual founder        | `demo-founder@example.test`          |
| Assigned mentor           | `demo-mentor@example.test`           |
| Platform administrator    | `demo-admin@example.test`            |
| High-school administrator | `demo-school@example.test`           |
| University administrator  | `demo-university-staff@example.test` |

Select **Switch demo role** in the blue header to switch accounts in the same tab. If the approval queue is empty but your product shows a pending status, return to the browser profile that shows the product and choose **Switch demo role to review** from **View**. **Reset demo data** clears previous local demo work.

## 0. Guest access, applications, and institutional invitations

Use the same browser profile and local address throughout. Each role sees the fictional records saved on that address. The invitation screen simulates account activation in the browser. Real email delivery and password setup require the authentication backend.

### A. Apply for incubation as a guest

1. Open **Demo accounts** and choose **Morgan Kariuki — Guest**, or create a fictional account from **Create account**. The guest lands on the public **Account** page. Open **Browse courses** and confirm the catalogue shows **Incubation Pathway** and **General Courses**.
2. Open a general course. Enroll, confirm the demo payment if the course has a fee, and mark each lesson complete. Use **Track your certificate** and confirm the course certificate is visible in the public account. Open **Events** from the public site, reserve an open session, and check **Account → Event reservations**. Open `/dashboard` directly as the guest and confirm it redirects to the public account.
3. In **Courses → Incubation Pathway**, select **Apply for incubation**. Keep **Youth Entrepreneur / Learner** selected, choose **Lakeside Demo University**, enter your affiliation and motivation, and select **Submit application**. Check that the application is pending and that the account still gives access to general courses.
4. Switch to **Alex Mwangi — Platform Administrator**. Open **Approval queue → Role requests**. Search for the learner, find the affiliated institution in the table, and open **Review**. Choose **Reject**, enter a reason, and save. Switch back to the same guest and verify the feedback and the option to apply again.
5. Submit a new application and approve it as Alex. Sign back in using the same learner account. The learner now lands on the entrepreneur dashboard. Check the affiliation in **Profile** or **Incubation**, verify earlier course progress, and create a venture to unlock **Launch venture** in the pathway workspace.

### B. Onboard a hub and invite members

1. As Alex, go to **Institution directory → Add institution**. Choose **Hub**, enter the name and agreed amount, and select an available administrator or leave **Assign later** selected. **Create institution** opens the pending record’s **Intake** page.
2. If the administrator is unassigned, create a separate fictional guest account or use an available test account. As Alex, give it the **Institutional Administrator** role in **Users & roles → Manage access**. Return to the hub and select **Portal activation → Assign administrator**. Record the visit and terms and upload a dummy signed PDF up to 250 KB under **Agreements**. Click **Activate institution** in **Portal activation** and confirm. The institution changes from **Pending** to **Active**.
3. Sign in as the hub administrator. Open **Portal → Invitations → Invite member**. Enter a fictional name and an unused email. Select **Create invitation**, then **Open invitation link** in the invitation row.
4. On the invitation page, sign out of the staff account. Enter a fictional city or county, accept the demo terms, and select **Activate demo account**. Confirm that the account opens the entrepreneur dashboard immediately and displays the hub affiliation in **Profile**. Switch back to the hub administrator and verify that **Members** lists the learner and **Invitations** shows **Accepted**.
5. Test an existing guest account with general-course progress by inviting its exact email. Sign in with that email from the invitation page and select **Accept invitation**. Confirm the same account opens the entrepreneur dashboard with its saved learning progress. Platform administrators can also invite members directly from **Institution directory → Manage institution → Invitations**.
6. As the platform administrator, confirm the active hub appears in the public incubation application selector. A second institution administrator should only see invitations and members for the institution they manage.

#### Invite a batch and check institution sign-in

1. As **Ari Kamau** or the primary administrator of an active hub, open **Overview** and check the institution name below the welcome heading. Open **Portal** and confirm the institution name appears above the tabs.
2. In **Invitations**, choose **Invite members**. Paste one name and email per line, such as `Amina Demo, amina-batch@example.test` and `Brian Demo, brian-batch@example.test` on separate lines. Select **Create invitations**. Confirm that each row has its own **Open invitation link**. Repeat with a duplicate or an email already affiliated elsewhere. The form should identify the matching entry and save none of the batch.
3. Accept one of the new invitations and confirm the learner appears in that institution’s **Members** tab as a Youth Entrepreneur. Keep using the same browser profile and local address. Demo invitation links use records stored in that browser.
4. Sign out and use the website’s **Sign in** link. Select **Lakeview Demo High School**, continue, and submit `demo-university-staff@example.test`. Verify the mismatch error and check that you are still signed out. Select **Change institution**, choose **Lakeside Demo University**, and retry with the same email. Ari’s portal should open. Repeat with an accepted hub invitee at the wrong university, then at their own hub.
5. Use **YERH** for an independent account such as `demo-admin@example.test`. To verify the high-school route, use `demo-school@example.test` with **Lakeview Demo High School**. School student profiles remain offline.

#### Track university and hub members

1. Sign in as **Ari Kamau — Institutional Administrator** for **Lakeside Demo University**. Open **Portal → Member Progress**. On fresh demo data, **Demo Green Basket** is ready to launch, and members without a venture have **Create a venture** in the Next action column. Use a member’s name to see all their ventures and a venture’s name to see its three stages and pathway activity.
2. For an end-to-end hub test, complete the hub invitation steps above. Before acceptance, check **Portal → Invitations**. After acceptance, check **Member Progress** for the new member. As the learner, use the **Incubation Pathway** quick action. Create a venture in **Ventures**, approve it as Alex in **Approval queue → Ventures & organisations**, then go back to the learner and choose **Incubation → Launch venture**. A product is optional.
3. As the institution administrator, confirm the venture shows **Awaiting mentor assignment**. Use **Next action** to filter on that value and **Export CSV** to verify the download has only the matching rows. As Alex, assign Jordan in **Approval queue → Incubation applications**. As the learner, open the pathway, save both **Getting Started** evidence steps, and select **Request stage review**. Switch to the institution administrator and confirm **Getting Started** shows **Awaiting mentor review**.
4. As Jordan, go to **Mentees & milestones → Assigned ventures → Review stages**. Schedule the meeting and open the assessment. As the learner, submit an exam answer. As Jordan, grade it. The institution’s report should now show **Intermediate / Advanced** as the current stage. In the sidebar under **Institution → Payments & Certificates**, confirm the Getting Started fee shows **Payment needed**.
5. As the learner, select **Record demo payment** for the Getting Started certificate. The institution should see **Awaiting confirmation**. As Alex, confirm it in **Payments → Awaiting confirmation**, then issue the certificate in **Certificates → Awaiting approval**. Back in the institution, verify **Confirmed** and **Issued**. For **Funding (Aid)** or the final venture certificate, verify **No fee** after the required stages are assessed.
6. Create or launch a second venture for the same learner and confirm it has its own row and stage. Switch to Ari and verify that the hub learner is absent from the university report and CSV. As Alex, open the hub in **Institution directory → Manage institution → Member Progress** to verify the same hub report. A user assigned read-only institution access can view progress without programme payment records.

### C. Verify the high-school route

1. Choose **Sam Njeri — Institutional Administrator**, then open **Portal → Students**. Add a fictional student. Confirm the record asks for school details such as form and admission number and gives access to the staff roster.
2. Use **Venture teams** to group students, record a session in **Classes**, and follow the [school results walkthrough](#3-school-cohorts-results-and-certificates) to launch a team venture, enter marks, and request certificates. Staff can download issued certificates for distribution.
3. Return to **Demo accounts** and confirm the new student has no sign-in card. Confirm **Lakeview Demo High School** is available to its authorized staff and is omitted from the public incubation application selector. High-school institution records use **Students**, while university and hub records use **Members** and invitations.

## 1. Individual founder, mentor, and certificates

1. Sign in as the founder and open **Incubation**. To test a newly affiliated entrepreneur, use the guest application or institutional invitation walkthrough above.
2. In **Products**, select **Add product**. In the dialog, choose **Demo Green Basket**, enter a product name, a description of at least 20 characters, and a price in KES. Select **Submit product for approval**. The product appears in the Products table.
3. Open **View**, then select **Switch demo role to review**, then choose **Alex Mwangi — Platform Administrator**. In **Approval queue → Product listings**, select **Review listing**, then **Approve listing**.
4. Switch back to the founder. In **Incubation**, select **Launch venture**. Choose **Demo Green Basket**, check the product under **Products in scope**, enter a goal of at least 30 characters, and select **Launch into incubation**. As platform administrator, open **Approval queue → Incubation applications**. Select **Review application** for the venture, choose the demo mentor and **Accept & assign**, then select **Save incubation decision**.
5. As founder, select **Open pathway** beside the venture in **Incubation**, then expand **Getting Started**. Select **Add evidence** for each step and save it. Choose **Request mentor feedback** on the first step and verify that the second step stays available. Select **Request stage review**.
6. As mentor, open **Mentees & milestones → Assigned ventures** and select **Review stages** on the venture. Send feedback, select **Schedule meeting**, then select **Record review decision** and choose **Ready · open stage exam**. On a separate pass, try **Request revisions** and verify that the founder can edit and resubmit.
7. As founder, select **Enter exam answer** inside the opened stage and submit it. As mentor, select **Grade exam** and enter **40%**. Verify **Intermediate / Advanced** unlocks as soon as the grade is recorded. The pass benchmark is **50%**.
8. Under the first stage certificate, select **Record demo payment**. As platform administrator, open **Payments → Awaiting confirmation**, then **Review payment** and confirm it. In **Certificates → Awaiting approval**, select **Issue certificate**, then **Approve and issue certificate**. Check that the record appears in the founder’s **Certificates**.
9. Repeat the evidence, mentor review, exam, and grade for **Intermediate / Advanced** and **Funding (Aid)**. Before a Funding grade is recorded, verify the final venture certificate is absent from the approval queue. You may leave the intermediate certificate unpaid. After the Funding grade, issue the free Funding stage certificate and the free venture certificate in **Certificates**. The venture certificate names the owner and venture and lists the completed assessments under **Achievements**.
10. In **Products**, open **View** and submit the original product’s evidence. Approve it from the **Product evidence reviews** tab in the mentor’s **Mentees & milestones** or the administrator’s **Approval queue**. Verify the approved product is public. Add a second product under the graduated venture, open **View**, and select **Request targeted product review**. The second product goes public once its own evidence and listing moderation are approved.

## 2. Paid marketplace route and fee settings

1. As platform administrator, open **Payments → Fee settings → Edit payment settings**. Change one or more stage certificate prices and set a marketplace fee. Keep **Allow new paid listings without incubation** enabled and save.
2. As founder, create a venture with no incubation and add a product under it. Approve the venture in **Approval queue → Ventures & organisations**. Return as founder, open **View** and select **Record paid listing**. Check the fee matches the latest saved settings.
3. As platform administrator, confirm the payment while the product is awaiting moderation. The listing is still private. Approve the listing in **Approval queue**, then open the public product link from the founder’s **Products**.
4. Try a second product and decline its payment. Its public detail page stays unavailable. Disable new paid listings in **Payments** and verify the paid route disappears for new requests.

## 3. School cohorts, results, and certificates

1. Sign in as the school administrator. Select **Portal → Students → Add student**. Enter a name, gender, age, and form or grade. Search for the student, select **View**, then use **Edit** to update their details. Open **Venture teams → Add team** to group students. In **Classes → Record class**, select one or more teams or use **Select all teams**, then record attendance. The student and class tables export only the rows matching the current search and filters.
2. Create **Term 1** from **Results & Certificates → Add cohort**. In **Ventures → Add venture**, choose the team and cohort. Use **Assign cohort** for an existing venture. Save the venture, then launch it under **Incubation**. Open the pathway immediately after launch.
3. As school staff, open **Incubation → Open pathway** and save the team’s evidence for **Getting Started** and select **Open assessment** to enable mark entry.
4. As school staff, open **Portal → Assessments → Record marks** beside the venture. The same shortcut is in **Incubation**. The results table opens with that venture selected. **All pathways** includes existing records regardless of cohort membership.
5. Select **Add result**. Give one member **75%** and another **45%**. Use the pencil beside a recorded mark to correct the score. Filter by venture, assessment result, or search text, then use **Export results CSV** to download the matching rows. Both students can advance immediately after their marks are recorded. Save the next stage’s evidence and open its assessment to record marks.
6. Open the cohort’s **Certificates** tab. Both students appear for **Getting Started**. Use **Request certificate** or **Request all eligible**. Switch to the platform administrator and go to **Certificates → Awaiting approval → Review**. Check the evidence, class activities and recorded scores, then accept and issue certificates individually or in a batch. Reject a request with a reason, switch back to the school and verify the reason appears in the Certificates tab. Select **Request again** after addressing it. The venture certificate requires all three graded assessments and uses their average for the classification.
7. Return to the school’s cohort **Certificates** tab. Check the counts for each stage and use **Download HTML**, or open the certificate and choose **Print certificate → Save as PDF**. Verify **First Class** at 70% and above, **Second Class Upper** at 60–69%, **Second Class Lower** at 50–59%, and **Completion** below 50%. A school product stays in its venture workspace and is excluded from the marketplace and listing queue.

## 4. Onboard and manage an institution

1. As platform administrator, open **Institutions → Institution directory → Add institution**, choose the type, and enter the agreed amount. Select an available administrator or use **Assign later**. For an unassigned institution, give an available test account the **Institutional Administrator** role under **Users & roles → Manage access**, then assign it from **Portal activation**.
2. Select **Manage institution → Edit intake** to record the application, visit date, terms, and agreed amount. In **Staff & contacts**, select **Add staff or contact** to assign an eligible account, then use **Edit** to change or remove its access.
3. In the institution’s **Agreements** tab, select **View** beside **Agreed terms** and upload a dummy signed PDF up to 250 KB. Once the primary administrator and agreement are in place, choose **Activate institution** above the tabs and confirm. Upload another agreement and check that both PDFs remain downloadable.
4. Visit **Students**, **Ventures & products**, **Results & Certificates**, and **Activity log** in the institution’s admin record. Sign in as a school administrator to verify that the same institution’s **Agreements** tab is at the end of the portal navigation. Sign in as a results-only contact to verify that the contact can read results and issued certificates.
5. In the platform admin record, open **Intake → Edit success story** to feature the institution in **My Story** on the homepage. Use **Deactivate institution** and **Activate institution** to test access and record retention.

## 5. Courses and sign-in

1. As a founder, open **Courses**, select the **Incubation Pathway** card, and choose a venture. In **General Courses**, open a paid course and confirm the demo payment. Check that its lessons become available. The public course page also enforces this demo access rule.
2. As a mentor, open **Course proposals → Propose a course**, fill in the outline, and attach a PDF up to 250 KB. As platform admin, open **Courses → Proposals**, review the PDF, and approve with feedback and a royalty percentage.
3. Return as mentor. Select **Build course**, add a module, and publish with a price. As admin, set a discount in **Courses → Course catalogue**. Pay as a founder and verify the charged price, paid enrollment, and royalty in **Courses → Sales and royalties** and the mentor’s workspace.
4. Open **Sign in** to see the institution selector. The **Sign-in settings** gear in **Institutions → Institution directory** controls the YERH option. Open **Create an account** and verify that you can register with an active institution or leave it blank.
5. As a guest, enroll in **Business foundations** and mark the lessons complete. The last lesson brings **Course completed** into view. Select **Track your certificate** to see **Awaiting issuance**.
6. As platform administrator, open **Certificates → Course certificates**. Find the guest’s **Ready to issue** row, select **Issue certificate**, and confirm. Return as the guest, open **Certificates**, and verify that you can view and print the certificate.

## 6. Manage events and preview the catalogue

1. As platform admin, open **Administration → Events → Categories**. Add a category and choose its event type. Existing category names can be edited.
2. Open **Upcoming → Add event**. Add a title, description, venue, and start and end times in EAT. Choose the new category and save as **Draft**. Verify that the draft appears in Upcoming for administrators and is absent from Preview and the public events listings.
3. From the event row, select **Publish**. Verify the event appears in the entrepreneur catalogue under **Preview**, on the public Events page, and in the homepage’s upcoming events when it is among the next three. **Move to draft** hides it from discovery and preserves existing reservations.
4. In **Upcoming**, edit the event and set its schedule to **Completed**. Check **Archive**, edit the same record, and save new start and end times in the future. The record returns to **Upcoming** with the publication setting selected in the form.
5. Choose **Edit → Add host or facilitator**. Select a role, enter the presenter’s name and profession, and upload an optional JPEG, PNG or WebP photo. You can link an existing member or enter a guest presenter. Save and open **View event** to verify the roster. Images are cropped to a square and saved with the browser-local demo record.

## 7. Dashboard notification badges

1. Submit a venture as a founder, then switch to the platform administrator in the same browser. Look for an unread count on the bell and beside **Approval queue**. Select the sidebar link to open the queue tab with unseen work.
2. Check that the venture remains in the queue after the badge clears. Submit another venture or resubmit a returned record and verify that its new submission creates a new count.
3. Select the bell to see each queue and its outstanding items. Use **Mark all as seen** to clear the remaining badges. Open an individual notification to acknowledge just that queue.

## Production handoff

The mock data and all role switches run in one browser. The LMS vendor remains open. The mock curriculum in `src/mocks/data/platform.json` maps each venture stage to learning materials and an exam prompt. For production, a server adapter should use the chosen LMS to launch lessons and exams and import trusted learner, venture enrolment, stage, attempt, and grade records. Online grades and authorized offline marks follow the same prior-stage rules in YERH. The production backend also needs authenticated institution access, secure agreement storage, verified payments, and durable credentials.

The Getting Started professional-profile exercise supports a private or paper draft that students can prepare with school staff. Eligible students who choose LinkedIn create and control their own accounts.
