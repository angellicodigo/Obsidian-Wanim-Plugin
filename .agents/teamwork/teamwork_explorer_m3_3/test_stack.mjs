import vm from "vm";

function testStack() {
  const code = `
    class MyScene {
      construct() {
        this.helper();
      }
      helper() {
        throw new TypeError("Cannot read properties of null (reading 'get_center')");
      }
    }
    const scene = new MyScene();
    scene.construct();
  `;

  try {
    const fn = new Function(code);
    fn();
  } catch (err) {
    console.log("Raw stack:\n" + err.stack);
  }
}

testStack();
