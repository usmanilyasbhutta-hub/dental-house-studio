# Builds the hand-over archive. It contains the supplied case photographs, so
# the archive is written to the gitignored out/ folder and must stay private.
from pathlib import Path
import zipfile
p=Path(__file__).parent
selected=['render.py','case_geometry.py','build_reference_models.py','reference_models.py','build_materials.py','material_surfaces.py','make_comparison.py','fetch_references.py','README.md','REFERENCES.md','CURRENT_EDIT_BRIEF.md','REVIEW.json','barrier_timing_check.json','package_source.py','Reference_vs_Model_v8.jpg','Reference_vs_Model_v9.jpg']
out=p.parents[1]/'out'/'DHS_Whitening_Clinical_v9_Source.zip';out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    for name in selected:
        if (p/name).exists():z.write(p/name,f'Whitening_Clinical_v9/{name}')
    for f in sorted((p/'assets').glob('*')):
        if f.suffix in ('.png','.jpg'):z.write(f,f'Whitening_Clinical_v9/assets/{f.name}')
    for f in sorted((p/'models').glob('*.blend')):z.write(f,f'Whitening_Clinical_v9/models/{f.name}')
print(out)
