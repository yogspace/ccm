import { strToU8, type Zippable } from "fflate";
import type { MeshData } from "../geometry/mesh";
import { toStl } from "./stl";

/**
 * A photo-like picture of the cutter, rendered by Blender (Cycles) on the
 * admin's own computer: the MakerWorld zip carries the cutter as STL, this
 * Python script that builds the scene and renders, and a launcher to run
 * in Terminal. Blender runs in the background, without a window.
 */

/** The script's file name in the zip. */
const BLENDER_SCRIPT = "render-photo.py";
/** The launcher's: .command, so it runs on a double-click once allowed. */
const LAUNCHER = "render-photo.command";

// Plain Python – no backslashes and no dollar-brace, so it fits a template.
const PYTHON = `"""
Renders a photo-like picture of a cookie cutter with Blender's Cycles: the
print standing on a light stone slab in soft window light, its layers as
real relief, the PLA a little translucent. Runs in the background:

    blender -b --factory-startup -P render-photo.py -- cutter.stl photo.jpg "#ff6a1f"

An optional fourth argument sets the samples (default 256): more is
cleaner and slower.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

LAYER = 0.2  # mm - a printed layer, as the 3MF prints it
LINE = 0.42  # mm - a line of the top layer, side by side
MM = 0.001  # Blender works in meters
WIDTH, HEIGHT = 3200, 2400


def arguments():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) < 3:
        sys.exit(
            "usage: blender -b -P render-photo.py -- <cutter.stl> <photo.jpg> <#rrggbb> [samples]"
        )
    samples = int(args[3]) if len(args) > 3 else 256
    return os.path.abspath(args[0]), os.path.abspath(args[1]), args[2], samples


def linear(hex_color):
    """#rrggbb (sRGB) as Blender's linear RGB."""
    value = hex_color.lstrip("#")

    def channel(text):
        c = int(text, 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (channel(value[0:2]), channel(value[2:4]), channel(value[4:6]))


def set_input(node, name, value):
    """Sets an input where this Blender version has it (names change)."""
    if name in node.inputs:
        node.inputs[name].default_value = value


def maths(tree, operation, *values):
    """A math node: sockets are linked, numbers set."""
    node = tree.nodes.new("ShaderNodeMath")
    node.operation = operation
    for index, value in enumerate(values):
        if isinstance(value, (int, float)):
            node.inputs[index].default_value = value
        else:
            tree.links.new(value, node.inputs[index])
    return node.outputs[0]


def beads(tree, coordinate, width):
    """Round beads side by side, width apart: 0 in the grooves, 1 on top."""
    across = maths(
        tree,
        "MULTIPLY_ADD",
        maths(tree, "FRACT", maths(tree, "DIVIDE", coordinate, width)),
        2.0,
        -1.0,
    )
    return maths(
        tree, "SQRT", maths(tree, "SUBTRACT", 1.0, maths(tree, "POWER", across, 2.0))
    )


def waves(tree, coordinate, width):
    """Gentle waves, width apart: 0 in the grooves, 1 on top."""
    phase = maths(tree, "MULTIPLY", coordinate, 2 * math.pi / width)
    return maths(tree, "MULTIPLY_ADD", maths(tree, "COSINE", phase), 0.5, 0.5)


def import_cutter(path):
    """The cutter in millimeters as exported: centered, rim on the slab."""
    try:
        bpy.ops.wm.stl_import(filepath=path)
    except (AttributeError, RuntimeError):
        bpy.ops.import_mesh.stl(filepath=path)
    cutter = bpy.context.selected_objects[0]
    mesh = cutter.data

    # One vertex where triangles meet, so smooth shading can blend them.
    shape = bmesh.new()
    shape.from_mesh(mesh)
    bmesh.ops.remove_doubles(shape, verts=shape.verts, dist=0.0001)
    shape.to_mesh(mesh)
    shape.free()

    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    size = Vector((max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)))
    mesh.transform(
        Matrix.Translation(
            Vector(((min(xs) + max(xs)) / -2, (min(ys) + max(ys)) / -2, -min(zs)))
        )
    )
    cutter.scale = (MM, MM, MM)
    cutter.rotation_euler = (0, 0, math.radians(-28))

    # Smooth where the walls curve, sharp where they meet.
    mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    if hasattr(mesh, "use_auto_smooth"):
        mesh.use_auto_smooth = True
        mesh.auto_smooth_angle = math.radians(35)
    else:
        bpy.context.view_layer.objects.active = cutter
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    return cutter, size


def pla(hex_color):
    """
    PLA as it prints: on the walls every layer a round bead (its height
    across the layer a half circle), on top faces the top layer's lines,
    diagonal as the slicer lays them and pressed nearly flat; the grooves
    between darker and duller, the plastic a little translucent.
    """
    material = bpy.data.materials.new("PLA")
    material.use_nodes = True
    tree = material.node_tree
    bsdf = tree.nodes["Principled BSDF"]

    coords = tree.nodes.new("ShaderNodeTexCoord")
    xyz = tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(coords.outputs["Object"], xyz.inputs[0])
    walls = beads(tree, xyz.outputs["Z"], LAYER)
    diagonal = maths(
        tree, "MULTIPLY", maths(tree, "ADD", xyz.outputs["X"], xyz.outputs["Y"]), 0.7071
    )
    # The nozzle presses the top lines flat: no round beads, only gentle
    # waves that show where the light glances off them.
    lines = maths(tree, "MULTIPLY_ADD", waves(tree, diagonal, LINE), 0.4, 0.6)

    # Which faces look up: the lines there, the layers everywhere else.
    geometry = tree.nodes.new("ShaderNodeNewGeometry")
    normal = tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(geometry.outputs["Normal"], normal.inputs[0])
    top = tree.nodes.new("ShaderNodeMapRange")
    top.interpolation_type = "SMOOTHSTEP"
    top.inputs["From Min"].default_value = 0.8
    top.inputs["From Max"].default_value = 0.95
    tree.links.new(normal.outputs["Z"], top.inputs["Value"])
    bead = maths(
        tree,
        "MULTIPLY_ADD",
        maths(tree, "SUBTRACT", lines, walls),
        top.outputs["Result"],
        walls,
    )

    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 1.0
    # In meters: the grooves 0.04 mm deep - a print looks smooth, its
    # layers show only where the light glances off them.
    bump.inputs["Distance"].default_value = 0.00004
    tree.links.new(bead, bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    tint = tree.nodes.new("ShaderNodeVectorMath")
    tint.operation = "SCALE"
    tint.inputs[0].default_value = linear(hex_color)
    tree.links.new(maths(tree, "MULTIPLY_ADD", bead, 0.08, 0.92), tint.inputs["Scale"])
    tree.links.new(tint.outputs[0], bsdf.inputs["Base Color"])
    tree.links.new(maths(tree, "MULTIPLY_ADD", bead, -0.3, 0.7), bsdf.inputs["Roughness"])

    set_input(bsdf, "Subsurface Weight", 0.2)
    set_input(bsdf, "Subsurface Radius", (1.0, 0.5, 0.25))
    set_input(bsdf, "Subsurface Scale", 0.0015)
    set_input(bsdf, "Specular IOR Level", 0.5)
    return material


def stone():
    """Light stone: soft clouds, a fine grain and small pores."""
    material = bpy.data.materials.new("Stone")
    material.use_nodes = True
    tree = material.node_tree
    bsdf = tree.nodes["Principled BSDF"]
    coords = tree.nodes.new("ShaderNodeTexCoord")

    clouds = tree.nodes.new("ShaderNodeTexNoise")
    clouds.inputs["Scale"].default_value = 6.0
    clouds.inputs["Detail"].default_value = 8.0
    tree.links.new(coords.outputs["Object"], clouds.inputs["Vector"])
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (*linear("#d3d2ce"), 1.0)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (*linear("#ecebe8"), 1.0)
    tree.links.new(clouds.outputs["Fac"], ramp.inputs["Fac"])

    pores = tree.nodes.new("ShaderNodeTexVoronoi")
    pores.inputs["Scale"].default_value = 260.0
    tree.links.new(coords.outputs["Object"], pores.inputs["Vector"])
    pore = maths(tree, "LESS_THAN", pores.outputs["Distance"], 0.07)
    darken = tree.nodes.new("ShaderNodeVectorMath")
    darken.operation = "SCALE"
    tree.links.new(ramp.outputs["Color"], darken.inputs[0])
    tree.links.new(maths(tree, "MULTIPLY_ADD", pore, -0.25, 1.0), darken.inputs["Scale"])
    tree.links.new(darken.outputs[0], bsdf.inputs["Base Color"])

    grain = tree.nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 900.0
    grain.inputs["Detail"].default_value = 2.0
    tree.links.new(coords.outputs["Object"], grain.inputs["Vector"])
    relief = maths(tree, "SUBTRACT", grain.outputs["Fac"], pore)
    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.15
    bump.inputs["Distance"].default_value = 0.0005
    tree.links.new(relief, bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.75
    return material


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def use_gpu(scene):
    """The GPU where there is one (Metal on a Mac), else the CPU."""
    preferences = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            preferences.compute_device_type = kind
        except TypeError:
            continue
        preferences.get_devices()
        gpus = [device for device in preferences.devices if device.type != "CPU"]
        if gpus:
            for device in preferences.devices:
                device.use = device.type != "CPU"
            scene.cycles.device = "GPU"
            print("Rendering on", ", ".join(device.name for device in gpus))
            return
    print("Rendering on the CPU")


def main():
    stl_path, out_path, hex_color, samples = arguments()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    cutter, size = import_cutter(stl_path)
    cutter.data.materials.append(pla(hex_color))

    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, 0))
    bpy.context.active_object.data.materials.append(stone())

    # Soft room light all around, a big window to the left - both neutral,
    # or the stone turns beige.
    world = bpy.data.worlds.new("Room")
    scene.world = world
    world.use_nodes = True
    tree = world.node_tree
    environment = tree.nodes.new("ShaderNodeTexEnvironment")
    environment.image = bpy.data.images.load(
        os.path.join(
            bpy.utils.system_resource("DATAFILES", path="studiolights/world"),
            "interior.exr",
        )
    )
    neutral = tree.nodes.new("ShaderNodeHueSaturation")
    neutral.inputs["Saturation"].default_value = 0.2
    tree.links.new(environment.outputs["Color"], neutral.inputs["Color"])
    background = tree.nodes["Background"]
    background.inputs["Strength"].default_value = 0.08
    tree.links.new(neutral.outputs["Color"], background.inputs["Color"])

    window = bpy.data.lights.new("Window", "AREA")
    window.shape = "RECTANGLE"
    window.size, window.size_y = 0.6, 0.4
    window.energy = 8
    light = bpy.data.objects.new("Window", window)
    light.location = (-0.5, -0.1, 0.4)
    scene.collection.objects.link(light)
    look_at(light, (0, 0, 0))

    # A short telephoto, from the front and above, focused on the cutter.
    lens = bpy.data.cameras.new("Camera")
    lens.lens = 85
    lens.sensor_width = 36
    camera = bpy.data.objects.new("Camera", lens)
    scene.collection.objects.link(camera)
    scene.camera = camera
    radius = 0.5 * size.length * MM
    vertical = 2 * math.atan((lens.sensor_width * HEIGHT / WIDTH / 2) / lens.lens)
    distance = radius / math.sin(vertical / 2) * 0.95
    elevation, azimuth = math.radians(50), math.radians(-100)
    camera.location = (
        distance * math.cos(elevation) * math.cos(azimuth),
        distance * math.cos(elevation) * math.sin(azimuth),
        distance * math.sin(elevation),
    )
    target = (0, 0, size.z * MM * 0.3)
    look_at(camera, target)
    lens.dof.use_dof = True
    lens.dof.focus_distance = (Vector(target) - camera.location).length
    lens.dof.aperture_fstop = 8.0

    scene.render.engine = "CYCLES"
    use_gpu(scene)
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = WIDTH, HEIGHT
    scene.render.resolution_percentage = 100
    # True to the filament's color: AgX and Filmic would wash it out.
    for view in ("Khronos PBR Neutral", "Standard"):
        try:
            scene.view_settings.view_transform = view
            break
        except TypeError:
            continue
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 92
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    print("Saved", out_path)


main()
`;

/** A photo to render: what is in it, as one mesh, and its files' name. */
export type Photo = { mesh: MeshData; fileName: string };

const stlOf = (fileName: string) => `${fileName}.stl`;
const jpegOf = (fileName: string) => `${fileName}-photo.jpg`;

/**
 * The launcher: runs Blender in the background with each photo's file and
 * the color, one after another, and opens each photo it leaves next to
 * them as soon as it is there.
 */
const launcher = (photos: Photo[], color: string) => `#!/bin/sh
# Renders photo-like pictures of the cutters with Blender, in the
# background, and opens each - a minute or two apiece. macOS won't run a
# downloaded script on a double-click; in Terminal it runs from anywhere:
#   sh <this folder>/${LAUNCHER}
cd "$(dirname "$0")" || exit 1
BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"
[ -x "$BLENDER" ] || BLENDER="$(command -v blender)"
if [ -z "$BLENDER" ]; then
  echo "Blender not found - get it from blender.org."
  exit 1
fi
render() {
  echo "Rendering $2 - this takes a minute or two ..."
  "$BLENDER" -b --factory-startup -P ${BLENDER_SCRIPT} -- "$1" "$2" "${color}" || exit 1
  open "$2"
}
${photos
  .map(({ fileName }) => `render "${stlOf(fileName)}" "${jpegOf(fileName)}"`)
  .join("\n")}
`;

/**
 * Unix permissions for the launcher: a regular file (macOS's Archive
 * Utility drops the mode without the type) that may be run.
 */
const EXECUTABLE = 0o100755 * 0x10000;

/**
 * The zip's files for the photos, in the order they are rendered – a set's
 * all together, then each cutter on its own: each as STL, the script, the
 * launcher.
 */
export const blenderFiles = async (
  photos: Photo[],
  color: string
): Promise<Zippable> => {
  const files: Zippable = {};
  for (const { mesh, fileName } of photos) {
    files[stlOf(fileName)] = new Uint8Array(await toStl(mesh).arrayBuffer());
  }
  files[BLENDER_SCRIPT] = strToU8(PYTHON);
  files[LAUNCHER] = [
    strToU8(launcher(photos, color)),
    { os: 3, attrs: EXECUTABLE },
  ];
  return files;
};

/**
 * The Terminal line that renders the photo – the zip unpacked where it was
 * downloaded, in a folder of its name (`folder`).
 */
export const photoCommand = (folder: string) =>
  `sh ~/Downloads/${folder}/${LAUNCHER}`;
