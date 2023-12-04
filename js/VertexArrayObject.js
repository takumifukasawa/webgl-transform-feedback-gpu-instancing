
import { GLObject } from "./GLObject.js";
import { IndexBufferObject } from "./IndexBufferObject.js";

export class VertexArrayObject extends GLObject {
    #vao;
    #vboList = {};
    #gpu;
    #ibo;
    indices;

    get hasIndices() {
        return !!this.#ibo;
    }

    get glObject() {
        return this.#vao;
    }

    constructor({gpu, attributes, indices = null}) {
        super();

        this.#gpu = gpu;

        const gl = this.#gpu.gl;
        this.#vao = gl.createVertexArray();

        // bind vertex array to webgl context
        gl.bindVertexArray(this.#vao);

        Object.keys(attributes).forEach(key => {
            const attribute = attributes[key];
            const { data, size, location, divisor } = attribute;
            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); // static draw 固定
            gl.enableVertexAttribArray(location);
            // size ... 頂点ごとに埋める数
            // stride is always 0 because buffer is not interleaved.
            // ref:
            // - https://developer.mozilla.org/ja/docs/Web/API/WebGLRenderingContext/vertexAttribPointer
            // - https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/vertexAttribIPointer
            switch(data.constructor) {
                case Float32Array:
                    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
                    break;
                case Uint16Array:
                    gl.vertexAttribIPointer(location, size, gl.UNSIGNED_SHORT, 0, 0);
                    break;
            }
            if(divisor) {
                gl.vertexAttribDivisor(location, divisor);
            }

            this.#vboList[key] = { vbo };
        });

        if(indices) {
            this.#ibo = new IndexBufferObject({ gpu, indices })
            this.indices = indices;
        }

        // unbind vertex array to webgl context
        gl.bindVertexArray(null);

        // unbind array buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // unbind index buffer
        if(this.#ibo) {
            this.#ibo.unbind();
        }
    }
}
