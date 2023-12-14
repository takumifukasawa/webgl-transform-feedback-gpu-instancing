import {PrimitiveTypes, UniformTypes} from "./constants.js";

const createWhite1x1 = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 1;
    canvas.height = 1;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1, 1);
    return canvas;
};

export class GPU {
    gl;
    shader;
    #vao;
    #uniforms = {};

    constructor({gl}) {
        this.gl = gl;
    }

    setShader(shader) {
        this.shader = shader;
    }

    setVertexArrayObject(vao) {
        this.#vao = vao;
    }

    setUniforms(uniforms) {
        this.#uniforms = uniforms;
    }

    setSize(x, y, width, height) {
        this.gl.viewport(x, y, width, height);
    }

    flush() {
        this.gl.flush();
    }

    clear(r, g, b, a) {
        const gl = this.gl;
        gl.depthMask(true);
        gl.colorMask(true, true, true, true);
        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(r, g, b, a);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    setUniformValues() {
        const gl = this.gl;

        const setUniformValueInternal = (type, uniformName, value) => {
            const location = gl.getUniformLocation(this.shader, uniformName);
            switch (type) {
                case UniformTypes.Int:
                    gl.uniform1i(location, value);
                    break;
                case UniformTypes.Float:
                    gl.uniform1f(location, value);
                    break;
                case UniformTypes.Vector3:
                    gl.uniform3fv(location, value.elements);
                    break;
                case UniformTypes.Matrix4:
                    // arg[1] ... use transpose.
                    gl.uniformMatrix4fv(location, false, value.elements);
                    break;
                case UniformTypes.Matrix4Array:
                    if (value) {
                        // arg[1] ... use transpose.
                        gl.uniformMatrix4fv(location, false, value.map(v => [...v.elements]).flat());
                    }
                    break;
                default:
                    throw `invalid uniform - name: ${uniformName}, type: ${type}`;
            }
        };

        // uniforms
        if (this.#uniforms) {
            Object.keys(this.#uniforms).forEach(uniformName => {
                const uniform = this.#uniforms[uniformName];
                setUniformValueInternal(uniform.type, uniformName, uniform.value);
            });
        }
    }

    updateTransformFeedback({shader, uniforms, transformFeedback, vertexArrayObject, drawCount}) {
        this.#uniforms = uniforms;
        this.shader = shader;
        this.vao = vertexArrayObject;

        const gl = this.gl;

        gl.bindVertexArray(this.vao.glObject);

        gl.useProgram(this.shader);

        this.setUniformValues();

        gl.enable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, drawCount);
        gl.endTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        gl.disable(gl.RASTERIZER_DISCARD);

        gl.useProgram(null);

        gl.bindVertexArray(null);

        this.shader = null;
        this.uniforms = {};
        this.vao = null;
    }

    draw({drawCount, instanceCount = 0, startOffset = 0}) {
        const gl = this.gl;

        // culling
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);

        // depth write
        gl.depthMask(true);

        // depth test
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        // blend
        gl.disable(gl.BLEND);

        gl.useProgram(this.shader);

        this.setUniformValues();

        // set vertex
        gl.bindVertexArray(this.#vao.glObject);

        // プリミティブは三角形に固定
        const glPrimitiveType = gl.TRIANGLES;
        // const glPrimitiveType = gl.LINES;

        // draw
        if (this.#vao.hasIndices) {
            // draw by indices
            // drawCount ... use indices count
            // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#ibo.glObject);
            if (instanceCount) {
                gl.drawElementsInstanced(glPrimitiveType, drawCount, gl.UNSIGNED_SHORT, startOffset, instanceCount)
            } else {
                gl.drawElements(glPrimitiveType, drawCount, gl.UNSIGNED_SHORT, startOffset);
            }
        } else {
            // draw by array
            // draw count ... use vertex num
            if (instanceCount) {
                gl.drawArraysInstanced(glPrimitiveType, startOffset, drawCount, instanceCount);
            } else {
                gl.drawArrays(glPrimitiveType, startOffset, drawCount);
            }
        }
    }
}
