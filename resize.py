import os
import glob
from PIL import Image

def resize_latest_image():
    upload_dir = r"C:\Users\salma\.gemini\antigravity\brain\95f06fa5-03db-4583-b814-06de2e4b06af\.user_uploaded"
    output_path = r"C:\Users\salma\.gemini\antigravity\brain\95f06fa5-03db-4583-b814-06de2e4b06af\logo_640x360.png"
    
    # Get all files in the upload directory
    list_of_files = glob.glob(os.path.join(upload_dir, '*'))
    if not list_of_files:
        print("No files found!")
        return
        
    # Get the latest file
    latest_file = max(list_of_files, key=os.path.getmtime)
    print(f"Resizing: {latest_file}")
    
    img = Image.open(latest_file).convert('RGBA')
    
    # Create a completely transparent background 640x360
    background = Image.new('RGBA', (640, 360), (0, 0, 0, 0))
    
    # Resize the original image to 360x360 (since it's a square logo)
    img = img.resize((360, 360), Image.Resampling.LANCZOS)
    
    # Calculate x, y to paste it in the center
    x = (640 - 360) // 2
    y = 0
    
    # Paste the image using the image itself as the mask to preserve its own transparency if any
    background.paste(img, (x, y), img)
    
    # Save the output
    background.save(output_path, "PNG")
    print("Done")

if __name__ == '__main__':
    resize_latest_image()
