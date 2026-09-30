# BAT Cowork shell build

The slim Tauri crate was not built. Do not treat `apps/bat-desktop/src-tauri` as a working shell.

Command (from `apps/bat-desktop/src-tauri`):

```
cargo check
```

Exit code: 101.

An earlier `cargo check --offline` never reached the compiler (`no matching package named serde found` because the crates.io index was not used). That was not a compile. The online `cargo check` below is the compile attempt. It was not run again after this failure.

Verbatim compiler error from that `cargo check`:

```
warning: glib-sys@0.18.1: Could not run `PKG_CONFIG_ALLOW_SYSTEM_CFLAGS=1 pkg-config --libs --cflags glib-2.0 'glib-2.0 >= 2.70'`
error: failed to run custom build command for `glib-sys v0.18.1`

Caused by:
  process didn't exit successfully: `/workspace/bat-cowork/apps/bat-desktop/src-tauri/target/debug/build/glib-sys-f8d3ce2aa7de016f/build-script-build` (exit status: 1)
  --- stdout
  cargo:rerun-if-env-changed=GLIB_2.0_NO_PKG_CONFIG
  cargo:rerun-if-env-changed=PKG_CONFIG_x86_64-unknown-linux-gnu
  cargo:rerun-if-env-changed=PKG_CONFIG_x86_64_unknown_linux_gnu
  cargo:rerun-if-env-changed=HOST_PKG_CONFIG
  cargo:rerun-if-env-changed=PKG_CONFIG
  cargo:rerun-if-env-changed=PKG_CONFIG_PATH_x86_64-unknown-linux-gnu
  cargo:rerun-if-env-changed=PKG_CONFIG_PATH_x86_64_unknown_linux_gnu
  cargo:rerun-if-env-changed=HOST_PKG_CONFIG_PATH
  cargo:rerun-if-env-changed=PKG_CONFIG_PATH
  cargo:rerun-if-env-changed=PKG_CONFIG_LIBDIR_x86_64-unknown-linux-gnu
  cargo:rerun-if-env-changed=PKG_CONFIG_LIBDIR_x86_64_unknown_linux_gnu
  cargo:rerun-if-env-changed=HOST_PKG_CONFIG_LIBDIR
  cargo:rerun-if-env-changed=PKG_CONFIG_LIBDIR
  cargo:rerun-if-env-changed=PKG_CONFIG_SYSROOT_DIR_x86_64-unknown-linux-gnu
  cargo:rerun-if-env-changed=PKG_CONFIG_SYSROOT_DIR_x86_64_unknown_linux_gnu
  cargo:rerun-if-env-changed=HOST_PKG_CONFIG_SYSROOT_DIR
  cargo:rerun-if-env-changed=PKG_CONFIG_SYSROOT_DIR
  cargo:rerun-if-env-changed=PKG_CONFIG_PATH_x86_64-unknown-linux-gnu
  cargo:rerun-if-env-changed=PKG_CONFIG_PATH_x86_64_unknown_linux_gnu
  cargo:rerun-if-env-changed=HOST_PKG_CONFIG_PATH
  cargo:rerun-if-env-changed=PKG_CONFIG_PATH
  cargo:rerun-if-env-changed=PKG_CONFIG_LIBDIR_x86_64-unknown-linux-gnu
  cargo:rerun-if-env-changed=PKG_CONFIG_LIBDIR_x86_64_unknown_linux_gnu
  cargo:rerun-if-env-changed=HOST_PKG_CONFIG_LIBDIR
  cargo:rerun-if-env-changed=PKG_CONFIG_LIBDIR
  cargo:rerun-if-env-changed=PKG_CONFIG_SYSROOT_DIR_x86_64-unknown-linux-gnu
  cargo:rerun-if-env-changed=PKG_CONFIG_SYSROOT_DIR_x86_64_unknown_linux_gnu
  cargo:rerun-if-env-changed=HOST_PKG_CONFIG_SYSROOT_DIR
  cargo:rerun-if-env-changed=PKG_CONFIG_SYSROOT_DIR
  cargo:warning=Could not run `PKG_CONFIG_ALLOW_SYSTEM_CFLAGS=1 pkg-config --libs --cflags glib-2.0 'glib-2.0 >= 2.70'`
  The pkg-config command could not be found.

  Most likely, you need to install a pkg-config package for your OS.
  Try `apt install pkg-config`, or `yum install pkg-config`, or `brew install pkgconf`
  or `pkg install pkg-config`, or `apk add pkgconfig` depending on your distribution.

  If you've already installed it, ensure the pkg-config command is one of the
  directories in the PATH environment variable.

  If you did not expect this build to link to a pre-installed system library,
  then check documentation of the glib-sys crate for an option to
  build the library from source, or disable features or dependencies
  that require pkg-config.
warning: build failed, waiting for other jobs to finish...
```

WebKit was not reached. `pkg-config` is not installed in this environment, so `glib-sys` failed in its build script before any linker step.
