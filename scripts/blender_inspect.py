# Lists the objects, world-space bounds, parents and materials of .blend files.
# Usage: scripts/blender --python scripts/blender_inspect.py -- <folder-or-file.blend>
import bpy,sys,glob,os
from mathutils import Vector
target=sys.argv[-1]
for f in ([target] if target.endswith('.blend') else sorted(glob.glob(target+'/*.blend'))):
    bpy.ops.wm.open_mainfile(filepath=f)
    sc=bpy.context.scene
    print('\n==',os.path.basename(f),'saved-with',bpy.data.version,'engine',sc.render.engine,'unit',sc.unit_settings.scale_length,'cam',tuple(round(v,1) for v in sc.camera.location),sc.camera.data.ortho_scale,'res',sc.render.resolution_x)
    for o in bpy.data.objects:
        if o.type in('CAMERA','LIGHT'):
            if o.type=='LIGHT':print('  LIGHT',tuple(round(v) for v in o.location),o.data.energy)
            continue
        bb=[o.matrix_world@Vector(c) for c in o.bound_box] if o.type!='EMPTY' else []
        mn=[round(min(v[i] for v in bb),1) for i in range(3)] if bb else None;mx=[round(max(v[i] for v in bb),1) for i in range(3)] if bb else None
        print('  ',o.type[:5],repr(o.name)[:42].ljust(42),'par',o.parent.name[:18] if o.parent else '-',mn,mx,[m.name[:22] for m in o.data.materials] if o.data and hasattr(o.data,'materials') else '')
