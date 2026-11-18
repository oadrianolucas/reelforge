/** Props of every app screen recreated for the "app" scene of the elegant style.
 *  marks: frames (since the scene start) of the words named in script.json → scene.marks (word indices).
 *  portrait: true in 9:16 (tablet standing), false in 4:5 and 1:1 (tablet lying down). */
export type ScreenProps = { marks: Record<string, number>; portrait: boolean };
