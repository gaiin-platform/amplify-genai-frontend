import { useEffect, createElement } from 'react';

export interface LoaderProps {
    size?: string;
    type?: string;
    color?: string;
}

export default function Loader({ color= '#FEEEB6', size = '160', type = 'quantum' }: LoaderProps) {
    useEffect(() => {
        async function getLoader() {
            const { quantum, dotStream, helix, infinity, grid, mirage, ripples, ping } = await import('ldrs')
            quantum.register()
            dotStream.register()
            helix.register()
            infinity.register()
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
        color: color,
        size: size,
    });

    return DynamicLoaderComponent;
}