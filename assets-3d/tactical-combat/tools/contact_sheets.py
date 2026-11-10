from PIL import Image,ImageDraw
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1];report=json.loads((root/'review/review-shots.json').read_text());names=['SprintProne','CrawlForward','ProneStand','CrouchWalk','CoverLeanLeft','CoverRise']
for faction in ['USMC','Russian']:
 sheet=Image.new('RGB',(1250,6*255),(22,33,43));draw=ImageDraw.Draw(sheet)
 for row,name in enumerate(names):
  cells=[x for x in report['shots']if x['faction']==faction and x['name']==name]
  for col,item in enumerate(cells):
   image=Image.open(item['file']).convert('RGB');c=item['crop'];image=image.crop((round(c['x']),round(c['y']),round(c['right']),round(c['bottom'])));image.thumbnail((244,200));x=col*250+(250-image.width)//2;y=row*255+35+(200-image.height)//2;sheet.paste(image,(x,y));draw.text((col*250+8,row*255+8),f"{faction} {name} {item['fraction']:.0%}",fill='#d5e4eb');draw.text((col*250+8,row*255+235),f"t={item['time']:.2f}s travel={c['distance']:.2f}m",fill='#9bc3c3')
 sheet.save(root/'review'/f'{faction}-tactical-contact-sheet.jpg',quality=94)
