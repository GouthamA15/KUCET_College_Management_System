import qrcode
from PIL import Image, ImageDraw, ImageFont

# --- CONFIGURATION FOR NEW POSTER ---
# UPI ID from the stained poster:
upi_id = "kuengineeringcollege@sbi"
# Name from the poster:
payee_name = "PRINCIPAL K U COLLEGE OF ENGIN"
# Construct the UPI payload
upi_data = f"upi://pay?pa={upi_id}&pn={payee_name}"

# 1. Generate QR Code
print(f"Generating QR for: {upi_id}")
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=10,
    border=2,
)
qr.add_data(upi_data)
qr.make(fit=True)
qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')

# 2. Setup Background Card
card_width = 600  # Made slightly wider for the long name
card_height = 700
background = Image.new('RGB', (card_width, card_height), 'white')
draw = ImageDraw.Draw(background)

# 3. Paste QR Code
qr_w, qr_h = qr_img.size
x_offset = (card_width - qr_w) // 2
y_offset = 200 # Space for header
background.paste(qr_img, (x_offset, y_offset))

# 4. Add Text
try:
    # Font settings
    font_header = ImageFont.truetype("arial.ttf", 28)
    font_bold = ImageFont.truetype("arialbd.ttf", 40) # Bold for Scan & Pay
    font_small = ImageFont.truetype("arial.ttf", 20)
    font_tiny = ImageFont.truetype("arial.ttf", 14)
except IOError:
    font_header = ImageFont.load_default()
    font_bold = ImageFont.load_default()
    font_small = ImageFont.load_default()
    font_tiny = ImageFont.load_default()

def draw_centered(text, font, y, color="black"):
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    x = (card_width - text_width) // 2
    draw.text((x, y), text, font=font, fill=color)

# -- Draw The Layout --

# SBI Logo Placeholder (Text representation)
draw_centered("State Bank of India", font_small, 40, color="#280071") # SBI Blue-ish

# Header
draw_centered("PRINCIPAL K U COLLEGE OF ENGIN", font_header, 90)

# "SCAN & PAY"
draw_centered("SCAN & PAY", font_bold, 140)

# Footer: UPI ID
draw_centered(f"UPI ID: {upi_id}", font_small, y_offset + qr_h + 20)

# Footer: Fee List (Simplified)
list_start_y = y_offset + qr_h + 60
fee_text = "Pay for: Tuition, Development, Processing, Certificates etc."
draw_centered(fee_text, font_tiny, list_start_y, color="gray")

# Border
draw.rectangle([(0,0), (card_width-1, card_height-1)], outline="black", width=3)

# 5. Save
output_filename = "principal_ku_qr.png"
background.save(output_filename)
print(f"Success! New image saved as: {output_filename}")