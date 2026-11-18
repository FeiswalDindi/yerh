# Incubation demo walkthrough

Run `npm run dev` from the repository and open [Demo accounts](http://127.0.0.1:5173/demo). If Vite is running on a different port, use the URL it prints. Open `/demo` on that same address each time you switch roles. Each browser profile and each website address, including a different local port or a hosted deployment, has its own demo records. Use fictional information and a dummy PDF for agreement testing. Demo fees are in Kenyan shillings.

| Role                      | Demo login                           |
| ------------------------- | ------------------------------------ |
| Individual founder        | `demo-founder@example.test`          |
| Assigned mentor           | `demo-mentor@example.test`           |
| Platform administrator    | `demo-admin@example.test`            |
| High-school administrator | `demo-school@example.test`           |
| University administrator  | `demo-university-staff@example.test` |

Select **Switch demo role** in the blue header to switch accounts in the same tab. If the approval queue is empty but your product shows a pending status, return to the browser profile that shows the product and choose **Switch demo role to review** in its table row. **Reset demo data** clears previous local demo work.

## 1. Individual founder, mentor, and certificates

1. Sign in as the founder. In **Incubation**, select **Set university** and choose **Lakeside Demo University**. To test a new university student, register with a fictional email, select a university in **My profile**, request the entrepreneur role, and approve it from **Approval queue → Role requests**.
2. In **Products**, select **Add product**. In the dialog, choose **Demo Green Basket**, enter a product name, a description of at least 20 characters, and a price in KES. Select **Submit product for approval**. The new row shows **Pending**.
3. On the product row, select **Switch demo role to review**, then choose **Alex Mwangi — Platform Administrator**. In **Approval queue → Product listings**, select **Review listing**, then **Approve listing**.
4. Switch back to the founder. In **Incubation**, select **Launch venture**. Choose **Demo Green Basket**, check the product under **Products in scope**, enter a goal of at least 30 characters, and select **Launch into incubation**. As platform administrator, open **Approval queue → Incubation applications**. Select **Review application** for the venture, choose the demo mentor and **Accept & assign**, then select **Save incubation decision**.
5. As founder, select **Open pathway** beside the venture in **Incubation**, then expand **Getting Started**. Select **Add evidence** for each step and save it. Choose **Request mentor feedback** on the first step and verify that the second step stays available. Select **Request stage review**.
6. As mentor, open **Mentees & milestones → Assigned ventures** and select **Review stages** on the venture. Send feedback, select **Schedule meeting**, then select **Record review decision** and choose **Ready · open stage exam**. On a separate pass, try **Request revisions** and verify that the founder can edit and resubmit.
7. As founder, select **Enter exam answer** inside the opened stage and submit it. As mentor, select **Grade exam** and enter **40%** to test a failed attempt. Verify the next stage stays locked, then repeat with a resit graded at **75%**. Verify **Intermediate / Advanced** unlocks immediately.
8. Under the first stage certificate, select **Record demo payment**. As platform administrator, open **Payments → Awaiting confirmation**, then **Review payment** and confirm it. In **Certificates → Awaiting approval**, select **Issue certificate**, then **Approve and issue certificate**. Check that the record appears in the founder’s **My certificates**.
9. Repeat the evidence, mentor review, exam, and passing grade for **Intermediate / Advanced** and **Funding (Aid)**. Before passing Funding, verify the final venture certificate is absent from the approval queue. You may leave the intermediate certificate unpaid. After the Funding pass, issue the free Funding stage certificate and the free venture certificate in **Certificates**. The venture certificate names the owner and venture.
10. In **Products**, open **Listing details** and submit the original product’s evidence. Approve it from the **Product evidence reviews** tab in the mentor’s **Mentees & milestones** or the administrator’s **Approval queue**. Verify the approved product is public. Add a second product under the graduated venture, open **Listing details**, and select **Request targeted product review**. The second product goes public once its own evidence and listing moderation are approved.

## 2. Paid marketplace route and fee settings

1. As platform administrator, open **Payments → Fee settings → Edit payment settings**. Change one or more stage certificate prices and set a marketplace fee. Keep **Allow new paid listings without incubation** enabled and save.
2. As founder, create a venture with no incubation and add a product under it. Approve the venture in **Approval queue → Ventures & organisations**. Return as founder, open **Listing details** and select **Record paid listing**. Check the fee matches the latest saved settings.
3. As platform administrator, confirm the payment while the product is awaiting moderation. The listing is still private. Approve the listing in **Approval queue**, then open the public product link from the founder’s **Products**.
4. Try a second product and decline its payment. Its public detail page stays unavailable. Disable new paid listings in **Payments** and verify the paid route disappears for new requests.

## 3. Offline high-school team and individual certificates

1. Sign in as the high-school administrator. In **Institution portal**, use **Students** to add or view students, **Venture teams** to add or view teams, and **Offline classes → Record class** for attendance. Use **Professional profile draft** on a student’s row to save a private portfolio.
2. From **My ventures → Add venture**, create one venture for the team. As platform admin, approve it in **Approval queue → Ventures & organisations**. Launch it from the school’s **Incubation** tab, then assign the mentor in **Approval queue → Incubation applications**.
3. As school administrator, select **Open pathway** and then **Individual contributions** to record each participant’s work. Save the team’s shared evidence for **Getting Started** and request a review. The mentor reviews it and opens the exam.
4. As school administrator, use **Record offline exam result** to enter a different mark for each member. Give one a passing mark and one a failing mark. In the next stage, verify the exam results form only offers students who passed the earlier stage. The student who failed can resit the earlier exam.
5. Complete all stages for one member. In admin **Certificates**, issue that member’s records without a separate student payment. The teammate sees their own progress and becomes eligible as they pass their remaining stages. Open **View certificate** from the school’s incubation screen to verify that the named student is identified as a contributor to the shared venture.
6. As the school administrator, select **Member results and certificates** under **Institution** in the sidebar. Search for the venture or student and select **View results**. For an issued record, choose **Download certificate (HTML)**. For a PDF, choose **View certificate → Print certificate → Save as PDF**.
7. Under a failed stage, choose **Record offline resit**, enter the new mark and assessment notes, and select **Save resit result**. Verify that both marks appear under **Attempts** and that a passing resit opens the next stage before the certificate is issued.

## 4. Onboard and feature an institution

1. As platform administrator, open **Users & roles → Manage access** to give an available demo member the **Institutional Administrator** role. Open **Institutions → Add institution**, choose its administrator and type, and enter the agreed amount.
2. Confirm the pending portal is locked. Use **Upload agreement** to attach a dummy PDF up to 250 KB. The button is in **Manage institution** for platform administrators and in **Institution portal** for the assigned administrator. As platform admin, open **Manage institution** and select **Approve agreement and activate**.
3. For a high school, verify that its administrator can now add students and teams while seeing only records from their own assigned institution. For a university, verify the active institution now appears in the founder’s university dropdown.
4. Open **Institutions → Manage institution → Edit success story**. Enter a school-level success story, check **Feature this institution on the homepage**, and save. Open the homepage **My Story** section, then clear the toggle to test removal.

## Production handoff

The mock data and all role switches run in one browser. The LMS vendor remains open. The mock curriculum in `src/mocks/data/platform.json` maps each venture stage to learning materials and an exam prompt. For production, a server adapter should use the chosen LMS to launch lessons and exams and import trusted learner, venture enrolment, stage, attempt, and grade records. Online grades and authorized offline marks follow the same prior-stage rules in YERH. The production backend also needs authenticated institution access, secure agreement storage, verified payments, and durable credentials.

The Getting Started professional-profile exercise supports a private or paper draft that students can prepare with school staff. Eligible students who choose LinkedIn create and control their own accounts.
