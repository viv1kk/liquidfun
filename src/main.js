import b2 from '../lib/liquidfun';
import {
    createVertexBuffer,
    createProgram,
    setVertexBuffer,
    updateVertexBuffer
} from './glutil';


const particleVsCode = `
attribute vec2 position;

uniform vec2 viewport;
void main() {
    gl_PointSize = 3.0;
    vec2 p = (position / viewport - 0.5) * 2.0;
    p.y = -p.y;
    gl_Position = vec4(p, 0.0, 1.0);
}
`;
const particleFsCode = `
precision highp float;
void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;
var stats = new Stats();
document.body.appendChild(stats.dom);

const canvas = document.createElement('canvas');
const mainDiv = document.querySelector('#main');
mainDiv.appendChild(canvas);
const width = mainDiv.clientWidth;
const height = mainDiv.clientHeight;

canvas.width = width;
canvas.height = height;

const searchStr = location.search.slice(1);
const searchItems = searchStr.split('&');
const urlOpts = {};
searchItems.forEach(item => {
    const arr = item.split('=');
    const key = arr[0];
    const val = arr[1] || true;
    urlOpts[key] = val;
});

let draw;
if (urlOpts.renderer === 'canvas') {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';

    draw = function (position) {
        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        for (let i = 0; i < position.length;) {
            const x = position[i++];
            const y = position[i++];

            ctx.rect(x, y, 3, 3);
            // ctx.fillRect(x, y, 3, 3);
        }
        ctx.fill();

        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            for (let k = 0; k < body.fixtures.length; k++) {
                const shape = body.fixtures[k].shape;
                const vertices = shape.vertices;
                const len = vertices.length;

                ctx.beginPath();
                ctx.moveTo(vertices[len - 1].x, vertices[len - 1].y)
                for (let m = 0; m < len; m++) {
                    const p = vertices[m];
                    ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            }
        }
    };
}
else {
    const gl = canvas.getContext('webgl');

    const posBuffer = createVertexBuffer(gl);
    const program = createProgram(gl, particleVsCode, particleFsCode);

    gl.useProgram(program);
    setVertexBuffer(gl, program, 'position', posBuffer, 2);

    gl.uniform2f(gl.getUniformLocation(program, 'viewport'), width, height);

    draw = function (position) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.viewport(0, 0, width, height);

        updateVertexBuffer(gl, posBuffer, position);

        gl.drawArrays(gl.POINTS, 0, position.length / 2);
    };
}

const bodies = [];
// https://beta.observablehq.com/@mbostock/liquidfun
function initPhysics() {
    const world = window.world = new b2.World(new b2.Vec2(0, 1000));
    const bd = new b2.BodyDef();
    const borderWidth = 2;
    bd.type = b2._staticBody;
    bd.allowSleep = false;
    // 4 Borders
    const body = world.CreateBody(bd);
    const p1 = new b2.PolygonShape();
    const cx = width / 2;
    const cy = height / 2;
    p1.SetAsBoxXYCenterAngle(borderWidth / 2, height / 2, new b2.Vec2(width, cy), 0);
    body.CreateFixtureFromShape(p1, 0);
    const p2 = new b2.PolygonShape();
    p2.SetAsBoxXYCenterAngle(borderWidth / 2, height / 2, new b2.Vec2(0, cy), 0);
    body.CreateFixtureFromShape(p2, 0);
    const p3 = new b2.PolygonShape();
    p3.SetAsBoxXYCenterAngle(width / 2, borderWidth / 2, new b2.Vec2(cx, height), 0);
    body.CreateFixtureFromShape(p3, 0);
    const p4 = new b2.PolygonShape();
    p4.SetAsBoxXYCenterAngle(width / 2, borderWidth / 2, new b2.Vec2(cx, 0), 0);
    body.CreateFixtureFromShape(p4, 0);

    const psd = new b2.ParticleSystemDef();
    psd.radius = 3;
    psd.dampingStrength = 0.2;
    const particleSystem = world.CreateParticleSystem(psd);
    const box = new b2.PolygonShape();
    box.SetAsBoxXYCenterAngle(150, 150, new b2.Vec2(cx, 150), 0);
    const particleGroupDef = new b2.ParticleGroupDef();
    particleGroupDef.shape = box;
    particleSystem.CreateParticleGroup(particleGroupDef);

    const barrierBd = new b2.BodyDef();
    barrierBd.type = b2._staticBody;
    const barrierBody = world.CreateBody(barrierBd);
    for (let i = 0; i < 10; i++) {
        const shape = new b2.PolygonShape();
        shape.SetAsBoxXYCenterAngle(
            100, 2,
            new b2.Vec2(Math.random() * 200 + 100, i * 50 + 100),
            0
        );
        barrierBody.CreateFixtureFromShape(shape, 0);
    }
    bodies.push(barrierBody);

    return {world};
}

const {world} = initPhysics();

function frame() {
    stats.begin();

    world.Step(0.01, 5, 3);

    const position = world.particleSystems[0].GetPositionBuffer();
    draw(position);

    stats.end();
    requestAnimationFrame(frame);
}

frame();

function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}
// https://github.com/liabru/matter-js/blob/master/examples/gyro.js
function updateGravity(event) {
    const orientation = typeof window.orientation !== 'undefined' ? window.orientation : 0;
    let x;
    let y;
    if (orientation === 0) {
        x = clamp(event.gamma, -90, 90) / 90;
        y = clamp(event.beta, -90, 90) / 90;
    }
    else if (orientation === 180) {
        x = clamp(event.gamma, -90, 90) / 90;
        y = clamp(-event.beta, -90, 90) / 90;
    }
    else if (orientation === 90) {
        x = clamp(event.beta, -90, 90) / 90;
        y = clamp(-event.gamma, -90, 90) / 90;
    }
    else if (orientation === -90) {
        x = clamp(-event.beta, -90, 90) / 90;
        y = clamp(event.gamma, -90, 90) / 90;
    }

    const scale = 1000 / Math.sqrt(x * x + y * y);

    world.SetGravity(new b2.Vec2(x * scale, y * scale));
};

function addSphere(e) {
    const pos = e.touches ? e.touches[0]: e;
    const x = pos.clientX;
    const y = pos.clientY;

}

window.addEventListener('deviceorientation', updateGravity);

window.addEventListener('click', addSphere);