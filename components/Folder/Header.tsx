export default function Header(){
    return (
        <header className="bg-red-#D42121 text-black py-4 sticky top-0 z-50">
            <div className="container mx-auto px-4 flex justify-between items-center">
                <div className="logo">
                </div>
                <div className="headerText">
                    <h1 className="text-xl font-semibold">Amplify</h1> 
                </div> 
            </div>
        </header>
    );
}