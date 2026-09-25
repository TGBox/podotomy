import { vi } from 'vitest';

// Mock 2D Canvas Context in JSDOM
if (typeof window !== 'undefined' && typeof window.HTMLElement !== 'undefined') {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

if (typeof HTMLCanvasElement !== 'undefined') {
    const mockWebGLContext = {
        getExtension: vi.fn(),
        getParameter: vi.fn().mockReturnValue(0),
        createTexture: vi.fn(),
        bindTexture: vi.fn(),
        texParameteri: vi.fn(),
        texImage2D: vi.fn(),
        clearColor: vi.fn(),
        clearDepth: vi.fn(),
        clearStencil: vi.fn(),
        enable: vi.fn(),
        disable: vi.fn(),
        depthFunc: vi.fn(),
        blendFunc: vi.fn(),
        viewport: vi.fn(),
        createShader: vi.fn(),
        shaderSource: vi.fn(),
        compileShader: vi.fn(),
        getShaderParameter: vi.fn().mockReturnValue(true),
        createProgram: vi.fn(),
        attachShader: vi.fn(),
        linkProgram: vi.fn(),
        getProgramParameter: vi.fn().mockReturnValue(true),
        useProgram: vi.fn(),
        createBuffer: vi.fn(),
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        getAttribLocation: vi.fn().mockReturnValue(0),
        enableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(),
        getUniformLocation: vi.fn().mockReturnValue({}),
        uniformMatrix4fv: vi.fn(),
        drawArrays: vi.fn(),
        drawElements: vi.fn(),
        canvas: { width: 800, height: 600 }
    };

    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
        if (contextId === '2d') {
            return {
                canvas: { width: 256, height: 256 },
                clearRect: vi.fn(),
                save: vi.fn(),
                restore: vi.fn(),
                beginPath: vi.fn(),
                arc: vi.fn(),
                fill: vi.fn(),
                stroke: vi.fn(),
                fillText: vi.fn(),
                createLinearGradient: vi.fn().mockReturnValue({
                    addColorStop: vi.fn()
                }),
                shadowColor: '',
                shadowBlur: 0,
                shadowOffsetX: 0,
                shadowOffsetY: 0,
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 1,
                font: '',
                textAlign: 'center',
                textBaseline: 'middle'
            };
        }
        if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
            return mockWebGLContext;
        }
        return null;
    }) as any;
}
