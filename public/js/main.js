class Game {

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.aspect = window.innerWidth / window.innerHeight;

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.stats = new Stats();
        this.up_stats = new Stats();
        function setStatPos(stat, left) {
            stat.domElement.style.position = "absolute";
            stat.domElement.style.left = left + "px";
            stat.domElement.style.top = "0px"
        }
        setStatPos(this.stats, 0);
        setStatPos(this.up_stats, 100);

        //this.up_stats.domElement.style.margin = "0px 0px 0px 80px";
        this.stats.showPanel(1);
        this.up_stats.showPanel(0);

        document.body.appendChild(this.stats.domElement);
        document.body.appendChild(this.up_stats.domElement);

        window.addEventListener( 'resize', this.onWindowResize.bind(this), false );

        this.keyboard = new KeyboardState();

        this.q0 = new THREE.Quaternion();
        this.q1 = new THREE.Quaternion();
        this.server_q = new THREE.Quaternion();

        this.current_time = performance.now();
        this.last_time = this.current_time;
        this.alpha = 0;

        this.loops = 0;
        this.sim_fps = 64;
        this.skip_ticks = 1000 / this.sim_fps;
        this.max_frame_skip = 10;
        this.next_game_tick = performance.now();
    }

    onWindowResize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }

    init() {
        var geometry = new THREE.BoxGeometry(1,1,1);
        var material = new THREE.MeshBasicMaterial({
            color: 0xff9999
        });
        this.cube = new THREE.Mesh(geometry,material);

        this.last_q = new THREE.Quaternion().copy(this.cube.quaternion);
        this.next_q = new THREE.Quaternion().copy(this.cube.quaternion);

        this.scene.add(this.cube);

        this.axes = new THREE.AxesHelper();
        this.axis_x = new THREE.Vector3(0,-1,0).normalize();
        this.axis_z = new THREE.Vector3(0,1,0);
        this.scene.add(this.axes);

        this.camera.position.z = 5;

        this.socket = io.connect("http://localhost:3000");
        this.socket.on("updateQuat", this.update_quaternion.bind(this));

        this.current_time = performance.now();
    }

    update_quaternion(data){
        this.server_q.x = data.quaternion._x;
        this.server_q.y = data.quaternion._y;
        this.server_q.z = data.quaternion._z;
        this.server_q.w = data.quaternion._w;
    }

    handle_input() {
        this.keyboard.update();
        this.should_rotate = false;
        this.rotate = this.axis_x;
        if (this.keyboard.pressed("A")){
            this.should_rotate = true;
            this.rotate = this.axis_x;
            this.socket.emit('keyPress', {key_id: "A", state: true, skip_ticks: this.skip_ticks});
        } else {
            this.socket.emit('keyPress', {key_id: "A", state: false, skip_ticks: this.skip_ticks});
        }

        if (this.keyboard.pressed("D")){
            this.should_rotate = true;
            this.rotate = this.axis_z;
            this.socket.emit('keyPress', {key_id: "D", state: true, skip_ticks: this.skip_ticks});
        } else {
            this.socket.emit('keyPress', {key_id: "D", state: false, skip_ticks: this.skip_ticks});
        }
    }

    gameTick() {
        this.q0.copy(this.q1);
        if (this.should_rotate){
            var degreesPerSecond = 90;
            var radiansPerSecond = degreesPerSecond*Math.PI*2/360;
            var radiansPerMillisecond = radiansPerSecond / 1000;
            this.q1.setFromAxisAngle(this.rotate, radiansPerMillisecond * this.skip_ticks);
            this.q1.multiplyQuaternions(this.q0, this.q1);
        }
    }

    draw() {

        this.alpha = 1.0 - ((this.next_game_tick - this.current_time) / this.skip_ticks);
        this.cube.quaternion.copy(this.server_q);
        //this.cube.quaternion.slerp(this.q1, this.alpha);

        this.renderer.render(this.scene, this.camera);
    }

    run() {
        requestAnimationFrame(this.run.bind(this));
        this.last_time = this.current_time;
        this.current_time = performance.now();

        this.handle_input();

        this.loops = 0;

        while (this.current_time > this.next_game_tick && this.loops < this.max_frame_skip) {
            this.up_stats.update();
            this.loops++;
            this.gameTick();
            this.next_game_tick += this.skip_ticks;
        }

        this.draw();

        //monitor performance
        this.stats.update();
    }
}

var game = new Game();
game.init();

game.run();