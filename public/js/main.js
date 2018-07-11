class Game {

    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xdbebfa);
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1512);
        this.camera.aspect = window.innerWidth / window.innerHeight;

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        
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
        
        this.latency = 0;

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
    
    createTerrain(){
        var generateHeight = function( width, height ) {
            var data = new Uint8Array( width * height ), perlin = new ImprovedNoise(),
            size = width * height, quality = 2, z = Math.random() * 100;
            for ( var j = 0; j < 4; j ++ ) {
                quality *= 4;
                for ( var i = 0; i < size; i ++ ) {
                    var x = i % width, y = ~~ ( i / width );
                    data[ i ] += Math.abs( perlin.noise( x / quality, y / quality, z ) * 0.5 ) * quality + 10;
                }
            }
            return data;
        }
        
        var data = generateHeight(1024, 1024);
        var material = new THREE.MeshPhongMaterial({color: 0x63B200, wireframe: false});
        material.flatShading = true;
        
        var quality = 8,
            step = 1024 / quality;
        
        var geometry = new THREE.PlaneGeometry(2000, 2000, quality -1, quality -1);
        geometry.rotateX(- Math.PI / 2);
        
        for (var i=0, l=geometry.vertices.length; i < l; i++){
            var x = i % quality,
                y = Math.floor(i / quality);
            geometry.vertices[i].y = data[(x*step)+(y*step)*1024] * 2 - 128;
        }
        
        //geometry.computeFlatVertexNormals();
        this.terrainMesh = new THREE.Mesh(geometry, material);
        this.terrainMesh.castShadow = true;
        this.scene.add(this.terrainMesh);
    }

    onWindowResize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }
    
    createLights(){
        this.pointLight = new THREE.PointLight(0xFDB813, 1.5, 1408);
        this.pointLight.castShadow = true;
        this.pointLight.position.x = 0;
        this.pointLight.position.y = 1024;
        this.pointLight.position.z = 0;
        this.scene.add(this.pointLight);
        
        this.ambLight = new THREE.AmbientLight(0xffebcd);
        this.scene.add(this.ambLight);
    
    }

    init() {
        var geometry = new THREE.BoxGeometry(1,1,1);
        var material = new THREE.MeshBasicMaterial({
            color: 0xff9999
        });
        this.cube = new THREE.Mesh(geometry,material);
        //this.scene.add(this.cube);
        this.createTerrain();
        
        this.axes = new THREE.AxesHelper();
        this.axis_x = new THREE.Vector3(0,-1,0).normalize();
        this.axis_z = new THREE.Vector3(0,1,0);
        this.scene.add(this.axes);
        
        this.createLights();

        this.camera.position.x = 512;
        this.camera.position.y = 768;
        this.camera.position.z = 512;
        this.camera.lookAt(0, 0, 0);

        this.setup_network("localhost");

        this.current_time = performance.now();
    }
    
    latency_update(ms){
        this.latency = ms;
        this.socket.emit("ping_back", {ping: ms});
    }
    
    setup_network(ip = "localhost", port = "3000"){
        this.socket = io.connect("http://"+ip+":"+port);
        this.socket.on("pong", this.latency_update.bind(this));
    }

    handle_input() {
        this.keyboard.update();
        this.should_rotate = false;
        this.rotate = this.axis_x;
        if (this.keyboard.pressed("A")){
            this.should_rotate = true;
            this.rotate = this.axis_x;
        }

        if (this.keyboard.pressed("D")){
            this.should_rotate = true;
            this.rotate = this.axis_z;
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
        this.cube.quaternion.copy(this.q0);
        this.cube.quaternion.slerp(this.q1, this.alpha);

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