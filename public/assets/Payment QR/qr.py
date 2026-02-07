import qrcode

def generate_ku_qr(amount):
    # 1. Define the specific KU Engineering College details
    upi_id = "kuengineeringcollege@sbi"
    payee_name = "PRINCIPALK U COLLEGE OF ENGIN"
    currency = "INR"
    
    # 2. Construct the UPI string with the fixed amount
    # Format: upi://pay?pa={id}&pn={name}&am={amount}&cu={currency}
    upi_payload = f"upi://pay?pa={upi_id}&pn={payee_name}&am={amount}&cu={currency}"
    
    # 3. Create the QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H, # High error correction
        box_size=10,
        border=4,
    )
    qr.add_data(upi_payload)
    qr.make(fit=True)

    # 4. Save the image
    file_name = f"ku_payment_{amount}.png"
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(file_name)
    print(f"✅ Success! QR code saved as: {file_name}")

# --- Run the function ---
try:
    amount_input = input("Enter the amount to fix (e.g. 500): ")
    # Verify it's a number
    float(amount_input)
    generate_ku_qr(amount_input)
except ValueError:
    print("Please enter a valid number.")