from pathlib import Path
from urllib.request import Request,urlopen
P=Path(__file__).parent/'reference_photos';P.mkdir(exist_ok=True)
urls={
'barrier.jpg':'https://www.sdi.com.au/downloads/Image_library/gingival/Gingival-barrier-hi.jpg',
'pola.jpg':'https://www.sdi.com.au/downloads/Image_library/pola/pola-office+with-tip_syringe-hi.jpg',
'pola_in_use.jpg':'https://images.tcdn.com.br/img/editor/up/182105/POLA_OFFICE_PLUS__BARREIRA_uso.jpg',
'fx57.png':'https://www.nskdental.com/admin/wp-content/uploads/FX57_y_al_1410.png',
'light.jpg':'https://www.sdi.com.au/downloads/Image_library/radii/SDI-Radii-cal-cx-hi.jpg',
'suction.jpg':'https://products.coltene.com/EN/AI/media/IMG_PAC_VA_462025-surgitip-SG-CL_OC.jpg',
'clinical.pdf':'https://sdiodonto.com.br/wp-content/uploads/2023/10/Pola-Office-Dental-Product-Report.pdf'}
for name,url in urls.items():
    if (P/name).exists():continue
    with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as r:(P/name).write_bytes(r.read())
    print(name)
