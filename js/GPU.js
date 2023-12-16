import {UniformTypes} from "./constants.js";

export class GPU {
    gl;
    // #uniforms = {};

    constructor({gl}) {
        this.gl = gl;
    }

    // setUniforms(uniforms) {
    //     this.#uniforms = uniforms;
    // }

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

    setUniformValues(gl, shader, uniforms = {}) {

        const setUniformValueInternal = (type, uniformName, value) => {
            const location = gl.getUniformLocation(shader, uniformName);
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
        // if (uniforms) {
            Object.keys(uniforms).forEach(uniformName => {
                const uniform = uniforms[uniformName];
                setUniformValueInternal(uniform.type, uniformName, uniform.value);
            });
        // }
    }

    updateTransformFeedback(gl, {shader, uniforms, transformFeedback, vertexArrayObject, drawCount}) {
        // this.#uniforms = uniforms;

        gl.bindVertexArray(vertexArrayObject);

        gl.useProgram(shader);

        this.setUniformValues(gl, shader, uniforms);

        gl.enable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, drawCount);
        gl.endTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        gl.disable(gl.RASTERIZER_DISCARD);

        gl.useProgram(null);

        gl.bindVertexArray(null);
    }

    draw(gl, shader, vao, uniforms, {hasIndices,  drawCount, instanceCount = 0, startOffset = 0}) {
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

        gl.useProgram(shader);

        this.setUniformValues(gl, shader, uniforms);

        gl.bindVertexArray(vao);

        // プリミティブは三角形に固定
        const glPrimitiveType = gl.TRIANGLES;

        // draw
        if (hasIndices) {
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
