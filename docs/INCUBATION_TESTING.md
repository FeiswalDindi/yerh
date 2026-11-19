# Incubation demo walkthrough

Run `npm run dev` from the repository and open [Demo accounts](http://127.0.0.1:5173/demo). If Vite is running on a different port, use the URL it prints. Open `/demo` on that same address each time you switch roles. Each browser profile and each website address, including a different local port or a hosted deployment, has its own demo records. Use fictional information and a dummy PDF for agreement testing. Demo fees are in Kenyan shillings.

| Role                      | Demo login                           |
| ------------------------- | ------------------------------------ |
| Individual founder        | `demo-founder@example.test`          |
| Assigned mentor           | `demo-mentor@example.test`           |
| Platform administrator    | `demo-admin@example.test`            |
| High-school administrator | `demo-school@example.test`           |
| University administrator  | `demo-university-staff@example.test` |

Select **Switch demo role** in the blue header to switch accounts in the same tab. If the approval queue is empty but your product shows a pending status, return to the browser profile that shows the product and choose **Switch demo role to review** from **View product**. **Reset demo data** clears previous local demo work.

## 1. Individual founder, mentor, and certificates

1. Sign in as the founder. In **Incubation**, select **Set university** and choose **Lakeside Demo University**. To test a new university student, register with a fictional email, select a university in **Profile**, request the entrepreneur role, and approve it from **Approval queue → Role requests**.
2. In **Products**, select **Add product**. In the dialog, choose **Demo Green Basket**, enter a product name, a description of at least 20 characters, and a price in KES. Select **Submit product for approval**. The product appears in the Products table.
3. Open **View product**, then select **Switch demo role to review**, then choose **Alex Mwangi — Platform Administrator**. In **Approval queue → Product listings**, select **Review listing**, then **Approve listing**.
4. Switch back to the founder. In **Incubation**, select **Launch venture**. Choose **Demo Green Basket**, check the product under **Products in scope**, enter a goal of at least 30 characters, and select **Launch into incubation**. As platform administrator, open **Approval queue → Incubation applications**. Select **Review application** for the venture, choose the demo mentor and **Accept & assign**, then select **Save incubation decision**.
5. As founder, select **Open pathway** beside the venture in **Incubation**, then expand **Getting Started**. Select **Add evidence** for each step and save it. Choose **Request mentor feedback** on the first step and verify that the second step stays available. Select **Request stage review**.
6. As mentor, open **Mentees & milestones → Assigned ventures** and select **Review stages** on the venture. Send feedback, select **Schedule meeting**, then select **Record review decision** and choose **Ready · open stage exam**. On a separate pass, try **Request revisions** and verify that the founder can edit and resubmit.
7. As founder, select **Enter exam answer** inside the opened stage and submit it. As mentor, select **Grade exam** and enter **40%** to test a failed attempt. Verify the next stage stays locked, then repeat with a resit graded at **75%**. Verify **Intermediate / Advanced** unlocks immediately.
8. Under the first stage certificate, select **Record demo payment**. As platform administrator, open **Payments → Awaiting confirmation**, then **Review payment** and confirm it. In **Certificates → Awaiting approval**, select **Issue certificate**, then **Approve and issue certificate**. Check that the record appears in the founder’s **Certificates**.
9. Repeat the evidence, mentor review, exam, and passing grade for **Intermediate / Advanced** and **Funding (Aid)**. Before passing Funding, verify the final venture certificate is absent from the approval queue. You may leave the intermediate certificate unpaid. After the Funding pass, issue the free Funding stage certificate and the free venture certificate in **Certificates**. The venture certificate names the owner and venture.
10. In **Products**, open **View product** and submit the original product’s evidence. Approve it from the **Product evidence reviews** tab in the mentor’s **Mentees & milestones** or the administrator’s **Approval queue**. Verify the approved product is public. Add a second product under the graduated venture, open **View product**, and select **Request targeted product review**. The second product goes public once its own evidence and listing moderation are approved.

## 2. Paid marketplace route and fee settings

1. As platform administrator, open **Payments → Fee settings → Edit payment settings**. Change one or more stage certificate prices and set a marketplace fee. Keep **Allow new paid listings without incubation** enabled and save.
2. As founder, create a venture with no incubation and add a product under it. Approve the venture in **Approval queue → Ventures & organisations**. Return as founder, open **View product** and select **Record paid listing**. Check the fee matches the latest saved settings.
3. As platform administrator, confirm the payment while the product is awaiting moderation. The listing is still private. Approve the listing in **Approval queue**, then open the public product link from the founder’s **Products**.
4. Try a second product and decline its payment. Its public detail page stays unavailable. Disable new paid listings in **Payments** and verify the paid route disappears for new requests.

## 3. School cohorts, results, and certificates

1. Sign in as the school administrator. Select **Institution portal → Students → Add student**. Enter a name, gender, age, and form or grade. Search for the student, select **View student**, then use **Edit student** to update their details. Open **Venture teams → Add team** to group students. In **Classes → Record class**, select one or more teams or use **Select all teams**, then record attendance. The student and class tables export only the rows matching the current search and filters.
2. Create **Term 1** from **Results & Certificates → Add cohort**. In **Ventures → Add venture**, choose the team and cohort. Use **Assign cohort** for an existing venture. As platform administrator, approve it in **Approval queue → Ventures & organisations**. Check for the tick next to the venture name. Launch it under **Incubation**. As platform admin, open **Approval queue → Incubation applications → Review application**, then choose **Activate school pathway**.
3. As school staff, open **Incubation → Open pathway → Individual contributions**. Record each participant’s contribution and choose **Save all contributions**. Save the team’s evidence for **Getting Started** and request the stage review. As platform administrator, open **Institutions → School assessments → Review school assessment** and approve mark entry.
4. As school staff, open **Institution portal → Assessments → Record marks** beside the venture. The same shortcut is in **Incubation**. The results table opens with that venture selected. **All pathways** includes existing records regardless of cohort membership.
5. Select **Add result**. Give one member **75%** and another **45%**. Open **View results** for the second member, add a resit, and confirm both attempts appear. Filter by venture, assessment result, or search text, then use **Export results CSV** to download the matching rows. After stage approval, the next stage offers mark entry for students who passed the previous stage.
6. Open the cohort’s **Certificates** tab. Use **Request certificate** for a single eligible record or **Request all eligible**. Switch to the platform administrator and issue the records under **Certificates → Awaiting approval**. The venture certificate requires all three stages and an individual contribution.
7. Return to the school’s cohort **Certificates** tab. Check the counts for each stage and use **Download HTML**, or open the certificate and choose **Print certificate → Save as PDF**. A school product stays in its venture workspace and is excluded from the marketplace and listing queue.

## 4. Onboard and manage an institution

1. As platform administrator, give an available demo member the **Institutional Administrator** role under **Users & roles → Manage access**. Go to **Institutions → Institution directory → Add institution**, choose the administrator and type, and enter the agreed amount.
2. Select **Manage institution → Edit intake** to record the application, visit date, terms, and agreed amount. In **Staff & contacts**, select **Add staff or contact** to assign an eligible account, then use **Edit access** to change or remove its access.
3. In the institution’s **Agreements** tab, select **View** beside **Agreed terms** and upload a dummy signed PDF up to 250 KB. Return to **Intake** and choose **Activate institution**. Upload another agreement and check that both PDFs remain downloadable.
4. Visit **Students**, **Ventures & products**, **Results & Certificates**, and **Activity log** in the institution’s admin record. Sign in as a school administrator to verify that the same institution’s **Agreements** tab is at the end of the portal navigation. Sign in as a results-only contact to verify that the contact can read results and issued certificates.
5. In the platform admin record, open **Intake → Edit success story** to feature the institution in **My Story** on the homepage. Use **Deactivate institution** and **Activate institution** to test access and record retention.

## 5. Courses and sign-in

1. As a founder, open **Courses**, select the **Incubation Pathway** card, and choose a venture. In **General Courses**, open a paid course and confirm the demo payment. Check that its lessons become available. The public course page also enforces this demo access rule.
2. As a mentor, open **Course proposals → Propose a course**, fill in the outline, and attach a PDF up to 250 KB. As platform admin, open **Courses → Proposals**, review the PDF, and approve with feedback and a royalty percentage.
3. Return as mentor. Select **Build course**, add a module, and publish with a price. As admin, set a discount in **Courses → Course catalogue**. Pay as a founder and verify the charged price, paid enrollment, and royalty in **Courses → Sales and royalties** and the mentor’s workspace.
4. Open **Sign in** to see the institution selector. The **Sign-in settings** gear in **Institutions → Institution directory** controls the YERH option. Open **Create an account** and verify that you can register with an active institution or leave it blank.

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
