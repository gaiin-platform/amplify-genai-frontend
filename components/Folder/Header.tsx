export default function Header(){
    return (
        <header className="bg-red text-black py-4 sticky top-0 z-50">
            <div className="container mx-auto px-4 flex justify-between items-center">
                <div className="headerText">
                    <h1 className="text-xl font-semibold">Amplify</h1> 
                </div> 
                <div className="logo">
                    <img className="DClogo" src="davidsonwordmark-lockup-on red.png"></img>
                </div>
            </div>
        </header>
    );
}