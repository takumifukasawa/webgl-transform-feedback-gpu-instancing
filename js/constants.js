export const PrimitiveTypes = {
    Points: "Points",
    Lines: "Lines",
    LineLoop: "LineLoop",
    LineStrip: "LineStrip",
    Triangles: "Triangles",
    TriangleStrip: "TriangleStrip",
    TriangleFan: "TriangleFan",
};

export const UniformTypes = {
    Matrix4: "Matrix4",
    Matrix4Array: "Matrix4Array",
    Texture: "Texture",
    Vector3: "Vector3",
    Float: "Float",
    Int: "Int",
};

export const AttributeUsageTypes = {
    StaticDraw: "StaticDraw",
    DynamicDraw: "DynamicDraw"
};

export const TextureTypes = {
    RGBA: "RGBA",
    RGBA32F: "RGBA32F"
};

export const TextureWrapTypes = {
    Repeat: "Repeat",
    ClampToEdge: "ClampToEdge",
};

export const TextureFilterTypes = {
    Nearest: "Nearest", // min, mag
    Linear: "Linear", // min, mag
    NearestMipmapNearest: "NearestMipmapNearest", // only min filter
    NearestMipmapLinear: "NearestMipmapLinear", // only min filter,
    LinearMipmapNearest: "LinearMipmapNearest", // only min filter
    LinearMipmapLinear: "LinearMipmapLinear", // only min filter
};

