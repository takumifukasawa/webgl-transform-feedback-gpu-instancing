import {GLObject} from "./GLObject.js";
import {IndexBufferObject} from "./IndexBufferObject.js";

export class VertexArrayObject extends GLObject {
    #vao;
    #vboList;
    #gpu;
    #ibo;
    indices;

    get hasIndices() {
        return !!this.#ibo;
    }

    get glObject() {
        return this.#vao;
    }
    
    getBuffers() {
        return this.#vboList.map(({ name, vbo }) => ({ name, buffer: vbo }));
    }
    
    setBuffer(name, newBuffer) {
        const target = this.#vboList.find(elem => elem.name === name);
        const gl = this.#gpu.gl;
        target.buffer = newBuffer;
        gl.bindVertexArray(this.#vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, newBuffer);
        gl.enableVertexAttribArray(target.location);
        gl.vertexAttribPointer(target.location, target.size, gl.FLOAT, false, 0, 0);
        // if (target.divisor) {
        //     gl.vertexAttribDivisor(target.location, target.divisor);
        // }
        gl.bindVertexArray(null);
    }
    
    findBuffer(name) {
        return this.#vboList.find(elem => elem.name === name).vbo;
    }

    constructor({gpu, attributes, indices = null}) {
        super();

        this.#gpu = gpu;
        this.#vboList = [];

        const gl = this.#gpu.gl;
        this.#vao = gl.createVertexArray();

        // bind vertex array to webgl context
        gl.bindVertexArray(this.#vao);

        attributes.forEach(attribute => {
            const {name, data, size, location, divisor, usage} = attribute;
            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, data, usage);
            gl.enableVertexAttribArray(location);
            // size ... 頂点ごとに埋める数
            // stride is always 0 because buffer is not interleaved.
            // ref:
            // - https://developer.mozilla.org/ja/docs/Web/API/WebGLRenderingContext/vertexAttribPointer
            // - https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/vertexAttribIPointer
            switch (data.constructor) {
                case Float32Array:
                    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
                    break;
                case Uint16Array:
                    gl.vertexAttribIPointer(location, size, gl.UNSIGNED_SHORT, 0, 0);
                    break;
            }
            if (divisor) {
                gl.vertexAttribDivisor(location, divisor);
            }

            this.#vboList.push({
                name,
                vbo,
                usage,
                location,
                size,
                divisor
            });
        });

        if (indices) {
            this.#ibo = new IndexBufferObject({gpu, indices})
            this.indices = indices;
        }

        // unbind vertex array to webgl context
        gl.bindVertexArray(null);

        // unbind array buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // unbind index buffer
        if (this.#ibo) {
            this.#ibo.unbind();
        }
    }
}
