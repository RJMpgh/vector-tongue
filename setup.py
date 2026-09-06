from setuptools import setup, find_packages

setup(
    name="vector-tongue",
    version="0.2.0",
    description="A falsifiable, output-only framework for learning and testing behavioral translation between AI models.",
    packages=find_packages(where="src", include=["vector_tongue*"]),
    package_dir={"": "src"},
    python_requires=">=3.10",
    entry_points={
        "console_scripts": [
            "vector-tongue = vector_tongue.cli:main",
        ],
    },
)
