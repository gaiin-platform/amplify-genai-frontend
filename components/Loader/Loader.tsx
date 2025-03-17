import {useEffect, createElement, useContext} from 'react';
import HomeContext from "@/pages/api/home/home.context";

export interface LoaderProps {
    size?: string;
    type?: string;
    color?: string;
}

export default function Loader({ color, size = '160', type = 'quantum' }: LoaderProps) {

    const state = useContext(HomeContext);

    let lightMode = 'dark';
    if(state) {
        lightMode = state.state.lightMode;
    }

    const isDarkMode = lightMode === 'dark';
    const lightAdjustedColor = color ? color : isDarkMode ? '#FEEEB6' : '#fde58f';

    useEffect(() => {
        async function getLoader() {
            const { quantum, dotStream, helix, infinity, grid, mirage, tailChase, tailspin, ring, ring2, lineSpinner,
                ripples, ping, jelly, dotPulse, spiral, squircle } = await import('ldrs')
            quantum.register()
            dotStream.register()
            ring.register()
            ring2.register()
            lineSpinner.register()
            tailChase.register()
            tailspin.register()
            helix.register()
            infinity.register()
            spiral.register()
            dotPulse.register()
            squircle.register()
            jelly.register()
            grid.register()
            mirage.register()
            ripples.register()
            ping.register()
        }
        getLoader();
    }, []);

    const loaderType = type.toLowerCase();

    // Use the `createElement` function from React to dynamically generate the loader element.
    // The tag name is constructed by prepending "l-" to the loader type.
    // This assumes that the custom elements have tag names that match the pattern: "l-{type}".
    const DynamicLoaderComponent = createElement(`l-${loaderType}`, {
        color: lightAdjustedColor,
        size: size,
    });

    return DynamicLoaderComponent;
}