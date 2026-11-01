import asyncio
import os
import edge_tts

OUT_DIR = os.path.abspath("artifacts/task4_video")
VOICE = "en-US-GuyNeural" # Professional, clear, instructional male voice

SCENES = [
    {
        "id": 1,
        "text": (
            "Welcome to the official payment verification and fraud prevention training for the KUCET College Management System. "
            "Every semester, Kakatiya University College of Engineering and Technology processes thousands of admission and fee payments. "
            "Verifying these payments with rigor is essential to protecting university funds and ensuring equity for genuine students. "
            "Digital payment screenshots can be entered incorrectly, reused, or manipulated with image-editing software. "
            "Our foundational institutional rule: A payment screenshot submitted by a student is evidence to review, never proof of money received."
        )
    },
    {
        "id": 2,
        "text": (
            "The payment verification lifecycle operates through six well-defined operational phases. "
            "First, the student uploads their receipt and enters the reference. "
            "Second, strict format validation checks UPI versus UTR syntax. "
            "Third, cryptographic SHA-256 and perceptual difference hashing catch identical or cropped screenshot re-use. "
            "Fourth, native optical character recognition extracts visible text and compares it against entered numbers and expected fees. "
            "Fifth, authoritative bank settlement records confirm payment. "
            "Otherwise, the record enters the Staff Review Queue with explainable flags for human decision-making."
        )
    },
    {
        "id": 3,
        "text": (
            "Here is a demonstration payment screenshot, prominently marked as synthetic evidence for training purposes. "
            "Callout 1: Displayed payment status. A visual checkmark can be easily fabricated; never rely on visual status alone. "
            "Callout 2: Displayed amount. Confirm that the amount matches the exact fee required for the applicant's category. "
            "Callout 3: The 12-digit Bank Reference or UTR Number. In India, genuine UPI transactions generate a 12-digit numeric reference issued by the remitter's bank. "
            "Callout 4: Beneficiary name. Ensure the money was transferred to Principal KU College of Engineering and Technology, not a personal account."
        )
    },
    {
        "id": 4,
        "text": (
            "In a correct submission, the candidate scans the college QR code or transfers to the official college UPI ID. "
            "The student uploads the genuine receipt and enters the 12-digit UTR into the transaction reference field. "
            "The system calculates the cryptographic and perceptual fingerprints, and assigns an initial status of SUBMITTED or NEEDS_REVIEW. "
            "Notice that the payment is never marked VERIFIED immediately upon upload. It awaits official university bank reconciliation."
        )
    },
    {
        "id": 5,
        "text": (
            "Let us examine Test Scenario 1: Student A submits genuine payment evidence for five hundred rupees with UTR 428190123456. "
            "The entered reference matches the screenshot, the image hash is unique, and external bank records confirm settlement in the SBI core banking feed. "
            "Because authoritative external confirmation exists, the status transitions to VERIFIED with an official verification badge. "
            "If bank data were unavailable, the record would remain in NEEDS_REVIEW rather than auto-approving."
        )
    },
    {
        "id": 6,
        "text": (
            "Test Scenario 2: Student B uploads Student A's screenshot and enters a 12-digit transaction ID into the UPI ID handle field. "
            "The system flags an Identifier Type Mismatch and an Exact Image Duplicate hash conflict. "
            "Notice how privacy is protected: Student A's personal details are never exposed to unauthorized parties. "
            "The submission is held in NEEDS_REVIEW for staff to investigate whether this is an accidental re-upload or fraudulent claim."
        )
    },
    {
        "id": 7,
        "text": (
            "Test Scenario 3: Student C crops the headers off Student A's screenshot. "
            "The byte-for-byte SHA-256 hash changes completely, which would fool a basic hash check. "
            "However, our 64-bit Perceptual Difference Hash detects an eighty-eight percent visual similarity with prior evidence on file. "
            "The system raises a Perceptual Image Match warning and holds the submission in NEEDS_REVIEW for staff inspection."
        )
    },
    {
        "id": 8,
        "text": (
            "Test Scenario 4: Student D submits a cropped screenshot showing UTR 428190123456, but enters altered reference 428190123499. "
            "Native OCR reads the visible receipt text and flags an OCR Discrepancy between entered and visible numbers. "
            "With an elevated risk score and no bank settlement record, the submission is held for thorough staff review."
        )
    },
    {
        "id": 9,
        "text": (
            "In the staff console, an authorized officer opens the transaction modal and reviews the amber risk alert banner. "
            "Staff inspect the full screenshot, compare against the daily university bank statement, and select the appropriate decision. "
            "Every decision records the verification method and reason in the immutable audit log with staff ID, timestamp, and IP address."
        )
    },
    {
        "id": 10,
        "text": (
            "Common mistakes to avoid: Never approve solely because a receipt looks clean. "
            "Never assume an entered reference proves payment without bank confirmation. "
            "Do not treat duplicate warnings as immediate proof of fraud; always investigate first. "
            "Never share receipts across unencrypted channels, and never leave an approval undocumented."
        )
    },
    {
        "id": 11,
        "text": (
            "Staff Operational Checklist: Confirm student record, fee amount, reference format, screenshot details, duplicate alerts, and bank match. "
            "Always record the verification method and audit reason before finalizing any payment record."
        )
    },
    {
        "id": 12,
        "text": (
            "In conclusion, remember our foundational institutional principle: "
            "A screenshot is evidence to review, not proof of money received. "
            "By combining the KUCET CMS fraud-detection engine with conscientious human oversight, we maintain institutional transparency and protect university funds. "
            "Thank you for your dedication to institutional excellence at KUCET."
        )
    }
]

async def generate_audio():
    print(f"Generating speech audio for {len(SCENES)} scenes using {VOICE}...")
    for scene in SCENES:
        mp3_path = os.path.join(OUT_DIR, f"scene{scene['id']}.mp3")
        communicate = edge_tts.Communicate(scene["text"], VOICE, rate="-4%")
        await communicate.save(mp3_path)
        print(f"Generated: scene{scene['id']}.mp3")
    print("All audio files generated successfully.")

if __name__ == "__main__":
    asyncio.run(generate_audio())
