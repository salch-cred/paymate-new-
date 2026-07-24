import os
from PIL import Image

def convert_to_gif():
    input_path = r"C:\Users\salma\.gemini\antigravity\brain\95f06fa5-03db-4583-b814-06de2e4b06af\logo_640x360.png"
    output_path = r"C:\Users\salma\.gemini\antigravity\brain\95f06fa5-03db-4583-b814-06de2e4b06af\logo_640x360.gif"
    
    img = Image.open(input_path)
    
    # Save as GIF
    img.save(output_path, "GIF")
    print("Done converting to GIF")

if __name__ == '__main__':
    convert_to_gif()
