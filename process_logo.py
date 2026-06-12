from PIL import Image

def remove_white_bg(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    
    newData = []
    for item in datas:
        # If it's very close to white, make it transparent
        # We can also do a smooth alpha blend for anti-aliasing
        # But simple threshold is often a good start
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            # White-ish pixel -> transparent
            # To avoid white halos, we could set the color to black with 0 alpha, 
            # or just 0 alpha.
            newData.append((item[0], item[1], item[2], 0))
        else:
            # Not white, keep it
            newData.append(item)
            
    img.putdata(newData)
    img.save(output_path, "PNG")

input_file = r"C:\Users\Asus rog\.gemini\antigravity-ide\brain\732ed983-c4c1-4350-a9b6-c9de6016cc47\media__1781211027393.png"
output_file = r"e:\klakoach\public\logo.png"

remove_white_bg(input_file, output_file)
print("Logo processed and saved to public/logo.png")
